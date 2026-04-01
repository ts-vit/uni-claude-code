import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import type { PipelineTask, PanelEvent, ClaudeEvent } from "../types/claude";
import { ARCHITECT_TASK_TEMPLATE, extractPromptFromResponse } from "../constants/pipelinePrompts";
import { useTauriListener } from "../utils/safeListener";

export type PipelineStatus = "idle" | "running" | "paused" | "error";

interface PipelineState {
  status: PipelineStatus;
  currentTaskId: string | null;
  currentPhase: "discuss" | "code" | null;
  log: PipelineLogEntry[];
}

export interface PipelineLogEntry {
  timestamp: number;
  taskId: string;
  taskTitle: string;
  phase: "discuss" | "code" | "system";
  message: string;
  type: "info" | "success" | "error";
}

// Panel IDs reserved for pipeline
const PIPELINE_DISCUSS_PANEL = "pipeline-discuss";
const PIPELINE_CODE_PANEL = "pipeline-code";
const MAX_PIPELINE_LOG_ENTRIES = 500;

export function usePipelineController(projectId: string, cwd: string, projectModel?: string | null) {
  const { t } = useTranslation();
  const [state, setState] = useState<PipelineState>({
    status: "idle",
    currentTaskId: null,
    currentPhase: null,
    log: [],
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const discussResponseRef = useRef("");
  const codeResultRef = useRef("");
  const tasksRef = useRef<PipelineTask[]>([]);
  const pauseRequestedRef = useRef(false);

  const addLog = useCallback((entry: Omit<PipelineLogEntry, "timestamp">) => {
    const logEntry = { ...entry, timestamp: Date.now() };
    setState((prev) => ({
      ...prev,
      log: [...prev.log, logEntry].slice(-MAX_PIPELINE_LOG_ENTRIES),
    }));
  }, []);

  const advanceToNext = useCallback(async () => {
    if (pauseRequestedRef.current) {
      pauseRequestedRef.current = false;
      setState((prev) => ({ ...prev, status: "paused", currentTaskId: null, currentPhase: null }));
      return;
    }

    // Find next queued task
    const tasks = await invoke<PipelineTask[]>("pipeline_task_list", { projectId });
    tasksRef.current = tasks;
    const nextTask = tasks.find((t) => t.status === "queued");

    if (!nextTask) {
      setState((prev) => ({ ...prev, status: "idle", currentTaskId: null, currentPhase: null }));
      notifications.show({ message: t("pipeline.completed"), color: "green" });
      return;
    }

    executeTask(nextTask);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, t]);

  const executeTask = useCallback(async (task: PipelineTask) => {
    discussResponseRef.current = "";
    codeResultRef.current = "";

    setState((prev) => ({
      ...prev,
      status: "running",
      currentTaskId: task.id,
      currentPhase: "discuss",
    }));

    await invoke("pipeline_task_set_status", { id: task.id, status: "discussing" });

    addLog({
      taskId: task.id,
      taskTitle: task.title,
      phase: "discuss",
      message: `Starting: ${task.title}`,
      type: "info",
    });

    // Find previous completed task for context
    const tasks = tasksRef.current;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    let previousResult: string | undefined;
    if (taskIndex > 0) {
      const prevTask = tasks[taskIndex - 1];
      if (prevTask.status === "done" && prevTask.resultSummary) {
        previousResult = prevTask.resultSummary;
      }
    }

    const architectPrompt = ARCHITECT_TASK_TEMPLATE(task.title, task.description, previousResult);

    try {
      await invoke("claude_start", {
        panelId: PIPELINE_DISCUSS_PANEL,
        prompt: architectPrompt,
        cwd,
        mode: "discuss",
        continueSession: false,
        model: projectModel || undefined,
        permissionMode: undefined,
      });
    } catch (err) {
      addLog({
        taskId: task.id,
        taskTitle: task.title,
        phase: "discuss",
        message: `Failed to start Discuss: ${err}`,
        type: "error",
      });
      await invoke("pipeline_task_set_status", { id: task.id, status: "failed" });
      await invoke("pipeline_task_set_result", {
        id: task.id,
        resultSummary: null,
        errorMessage: String(err),
      });
      advanceToNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, projectModel, addLog]);

  const handleCodeComplete = useCallback(async (isError: boolean, result?: string | null) => {
    const currentState = stateRef.current;
    if (!currentState.currentTaskId) return;

    const status = isError ? "failed" : "done";
    const summary = result ? result.slice(0, 500) : "Completed";

    await invoke("pipeline_task_set_status", { id: currentState.currentTaskId, status });
    await invoke("pipeline_task_set_result", {
      id: currentState.currentTaskId,
      resultSummary: isError ? null : summary,
      errorMessage: isError ? (result || "Unknown error") : null,
    });

    addLog({
      taskId: currentState.currentTaskId,
      taskTitle: "",
      phase: "code",
      message: isError ? `Failed: ${result?.slice(0, 200)}` : "Completed successfully",
      type: isError ? "error" : "success",
    });

    advanceToNext();
  }, [addLog, advanceToNext]);

  const handleDiscussComplete = useCallback(async () => {
    const currentState = stateRef.current;
    if (!currentState.currentTaskId) return;

    const response = discussResponseRef.current;
    const extractedPrompt = extractPromptFromResponse(response);

    if (!extractedPrompt) {
      addLog({
        taskId: currentState.currentTaskId,
        taskTitle: "",
        phase: "discuss",
        message: "Failed to extract prompt from Discuss response",
        type: "error",
      });
      await invoke("pipeline_task_set_status", { id: currentState.currentTaskId, status: "failed" });
      await invoke("pipeline_task_set_result", {
        id: currentState.currentTaskId,
        resultSummary: null,
        errorMessage: "Architect failed to produce a valid prompt",
      });
      advanceToNext();
      return;
    }

    // Save prompt and update status
    await invoke("pipeline_task_set_prompt", { id: currentState.currentTaskId, prompt: extractedPrompt });

    addLog({
      taskId: currentState.currentTaskId,
      taskTitle: "",
      phase: "discuss",
      message: "Prompt ready, sending to Code panel",
      type: "success",
    });

    // Send to Code panel
    codeResultRef.current = "";
    setState((prev) => ({ ...prev, currentPhase: "code" }));
    await invoke("pipeline_task_set_status", { id: currentState.currentTaskId, status: "executing" });

    try {
      await invoke("claude_start", {
        panelId: PIPELINE_CODE_PANEL,
        prompt: extractedPrompt,
        cwd,
        mode: "code",
        continueSession: false,
        model: projectModel || undefined,
        permissionMode: "bypass",
      });
    } catch (err) {
      addLog({
        taskId: currentState.currentTaskId,
        taskTitle: "",
        phase: "code",
        message: `Failed to start Code: ${err}`,
        type: "error",
      });
      await invoke("pipeline_task_set_status", { id: currentState.currentTaskId, status: "failed" });
      await invoke("pipeline_task_set_result", {
        id: currentState.currentTaskId,
        resultSummary: null,
        errorMessage: String(err),
      });
      advanceToNext();
    }
  }, [cwd, projectModel, addLog, advanceToNext]);

  // Listen to claude-event for pipeline panels
  useTauriListener<PanelEvent>(
    "claude-event",
    (event) => {
      const { panel_id, event: runnerEvent } = event.payload;

      if (panel_id !== PIPELINE_DISCUSS_PANEL && panel_id !== PIPELINE_CODE_PANEL) return;

      if ("Claude" in runnerEvent) {
        const ce = runnerEvent.Claude as ClaudeEvent;

        if (ce.type === "stream_event" && ce.event.type === "content_block_delta") {
          const delta = ce.event.delta;
          if (delta.type === "text_delta") {
            if (panel_id === PIPELINE_DISCUSS_PANEL) {
              discussResponseRef.current += delta.text;
            } else {
              codeResultRef.current += delta.text;
            }
          }
        }

        if (ce.type === "result") {
          if (panel_id === PIPELINE_DISCUSS_PANEL) {
            if (ce.result) {
              discussResponseRef.current = ce.result;
            }
            handleDiscussComplete();
          } else if (panel_id === PIPELINE_CODE_PANEL) {
            if (ce.result) {
              codeResultRef.current = ce.result;
            }
            handleCodeComplete(ce.is_error, ce.result);
          }
        }
      }

      if ("ProcessExited" in runnerEvent) {
        if (panel_id === PIPELINE_CODE_PANEL) {
          const code = runnerEvent.ProcessExited.code;
          if (code !== null && code !== 0) {
            handleCodeComplete(true, `Process exited with code ${code}`);
          }
        }
      }
    },
    [handleDiscussComplete, handleCodeComplete],
  );

  const start = useCallback(async () => {
    pauseRequestedRef.current = false;
    const tasks = await invoke<PipelineTask[]>("pipeline_task_list", { projectId });
    tasksRef.current = tasks;
    const firstQueued = tasks.find((t) => t.status === "queued");
    if (!firstQueued) {
      notifications.show({ message: t("pipeline.noQueuedTasks"), color: "yellow" });
      return;
    }
    executeTask(firstQueued);
  }, [projectId, executeTask, t]);

  const pause = useCallback(() => {
    pauseRequestedRef.current = true;
    setState((prev) => ({ ...prev, status: "paused" }));
  }, []);

  const stop = useCallback(async () => {
    pauseRequestedRef.current = false;
    // Stop both panels
    await invoke("claude_stop", { panelId: PIPELINE_DISCUSS_PANEL }).catch(() => {});
    await invoke("claude_stop", { panelId: PIPELINE_CODE_PANEL }).catch(() => {});

    if (stateRef.current.currentTaskId) {
      await invoke("pipeline_task_set_status", { id: stateRef.current.currentTaskId, status: "failed" });
      await invoke("pipeline_task_set_result", {
        id: stateRef.current.currentTaskId,
        resultSummary: null,
        errorMessage: "Stopped by user",
      });
    }

    setState((prev) => ({ ...prev, status: "idle", currentTaskId: null, currentPhase: null }));
  }, []);

  const resume = useCallback(() => {
    pauseRequestedRef.current = false;
    advanceToNext();
  }, [advanceToNext]);

  const clearLog = useCallback(() => {
    setState((prev) => ({ ...prev, log: [] }));
  }, []);

  return {
    ...state,
    start,
    pause,
    stop,
    resume,
    clearLog,
    PIPELINE_DISCUSS_PANEL,
    PIPELINE_CODE_PANEL,
  };
}
