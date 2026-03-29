import { useState, useEffect, useCallback, useRef } from "react";
import { Stack, Group, Text, Badge } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFolderOpen, IconMessage } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";

import type {
  RunnerEvent,
  ClaudeEvent,
  ChatMessage,
  SessionResult,
  PanelEvent,
} from "../../types/claude";
import { MessageList } from "./MessageList";
import { PromptInput } from "./PromptInput";
import { StatusBar } from "./StatusBar";

interface ChatPanelProps {
  panelId?: string;  // default "code"
  mode?: string;     // "code" | "discuss", default "code"
  cwd: string;
  projectId?: string;
  projectModel?: string | null;
  projectPermissionMode?: string;
}

export function ChatPanel({ panelId = "code", mode = "code", cwd, projectId, projectModel, projectPermissionMode }: ChatPanelProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

  // Track whether a session has been established (for --continue)
  const hasSessionRef = useRef(false);

  // Refs for streaming state (avoid stale closures)
  const currentBlockIndexRef = useRef<number>(-1);
  const toolJsonBuffersRef = useRef<Map<number, string>>(new Map());

  // Helper to update the last message of a given kind or append
  const appendTextToLast = useCallback((text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.kind === "assistant-text" && last.streaming) {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, text: last.text + text };
        return updated;
      }
      return [...prev, { kind: "assistant-text", text, streaming: true }];
    });
  }, []);

  const finalizeStreaming = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.kind === "assistant-text" && m.streaming ? { ...m, streaming: false } : m,
      ),
    );
    currentBlockIndexRef.current = -1;
    toolJsonBuffersRef.current.clear();
  }, []);

  const handleClaudeEvent = useCallback(
    (claudeEvent: ClaudeEvent) => {
      switch (claudeEvent.type) {
        case "system": {
          const wasExisting = hasSessionRef.current;
          hasSessionRef.current = true;
          const info = [
            claudeEvent.model && `Model: ${claudeEvent.model}`,
            claudeEvent.session_id && `Session: ${claudeEvent.session_id.slice(0, 8)}...`,
          ]
            .filter(Boolean)
            .join(" | ");
          if (info && !wasExisting) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.kind === "system-info" && last.text === info) {
                return prev; // deduplicate
              }
              return [...prev, { kind: "system-info", text: info }];
            });
          }
          break;
        }

        case "stream_event": {
          const event = claudeEvent.event;

          switch (event.type) {
            case "content_block_start": {
              currentBlockIndexRef.current = event.index;
              const block = event.content_block;
              if (block.type === "tool_use") {
                toolJsonBuffersRef.current.set(event.index, "");
                setMessages((prev) => [
                  ...prev,
                  {
                    kind: "tool-use",
                    toolName: block.name,
                    toolId: block.id,
                    inputJson: "",
                  },
                ]);
              }
              break;
            }

            case "content_block_delta": {
              const delta = event.delta;
              if (delta.type === "text_delta") {
                appendTextToLast(delta.text);
              } else if (delta.type === "input_json_delta") {
                const buf = toolJsonBuffersRef.current;
                const current = (buf.get(event.index) || "") + delta.partial_json;
                buf.set(event.index, current);
                // Update the last tool-use message's inputJson
                setMessages((prev) => {
                  const updated = [...prev];
                  for (let i = updated.length - 1; i >= 0; i--) {
                    const m = updated[i];
                    if (m.kind === "tool-use" && !m.result) {
                      updated[i] = { ...m, inputJson: current };
                      break;
                    }
                  }
                  return updated;
                });
              }
              break;
            }

            case "content_block_stop": {
              // Finalize current text block if it was text
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.kind === "assistant-text" && last.streaming) {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...last, streaming: false };
                  return updated;
                }
                return prev;
              });
              break;
            }

            case "message_stop": {
              finalizeStreaming();
              break;
            }
          }
          break;
        }

        case "user": {
          // Tool result from Claude's tool execution
          if (claudeEvent.message?.content) {
            for (const block of claudeEvent.message.content) {
              if (block.type === "tool_result") {
                setMessages((prev) => {
                  const updated = [...prev];
                  for (let i = updated.length - 1; i >= 0; i--) {
                    const m = updated[i];
                    if (m.kind === "tool-use" && m.toolId === block.tool_use_id && !m.result) {
                      updated[i] = {
                        ...m,
                        result: { content: block.content, isError: block.is_error },
                      };
                      break;
                    }
                  }
                  return updated;
                });
              }
            }
          }
          break;
        }

        case "assistant": {
          // Complete assistant message after streaming — replace current streaming text
          // with the finalized content to avoid duplication
          const textBlocks = claudeEvent.message.content
            .filter((b): b is { type: "text"; text: string } => b.type === "text")
            .map((b) => b.text)
            .join("");
          if (textBlocks) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.kind === "assistant-text") {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, text: textBlocks, streaming: false };
                return updated;
              }
              return [...prev, { kind: "assistant-text" as const, text: textBlocks, streaming: false }];
            });
          }
          break;
        }

        case "result": {
          // Replace streaming assistant text with final result if available
          if (claudeEvent.result) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.kind === "assistant-text") {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, text: claudeEvent.result!, streaming: false };
                return updated;
              }
              return [...prev, { kind: "assistant-text" as const, text: claudeEvent.result!, streaming: false }];
            });
          }
          setSessionResult({
            cost: claudeEvent.total_cost_usd,
            durationMs: claudeEvent.duration_ms,
            numTurns: claudeEvent.num_turns,
            sessionId: claudeEvent.session_id,
            permissionDenials: claudeEvent.permission_denials,
          });
          finalizeStreaming();
          break;
        }

        case "rate_limit_event": {
          const info = claudeEvent.rate_limit_info;
          if (info.status !== "allowed") {
            const resetsAtStr = info.resetsAt
              ? new Date(info.resetsAt * 1000).toLocaleTimeString()
              : "unknown";
            setMessages((prev) => [
              ...prev,
              { kind: "error", text: `Rate limited (${info.status}). Resets at: ${resetsAtStr}` },
            ]);
          }
          break;
        }
      }
    },
    [appendTextToLast, finalizeStreaming],
  );

  const handleRunnerEvent = useCallback(
    (payload: RunnerEvent) => {
      if ("Claude" in payload) {
        handleClaudeEvent(payload.Claude);
      } else if ("Stderr" in payload) {
        console.warn("claude stderr:", payload.Stderr);
      } else if ("ProcessExited" in payload) {
        setIsRunning(false);
        finalizeStreaming();
        const code = payload.ProcessExited.code;
        if (code !== null && code !== 0) {
          setMessages((prev) => [
            ...prev,
            { kind: "system-info", text: t("chat.processExited", { code }) },
          ]);
        }
      }
    },
    [handleClaudeEvent, finalizeStreaming, t],
  );

  // Listen to claude-event — filter by panelId
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<PanelEvent>("claude-event", (event) => {
      if (event.payload.panel_id !== panelId) return;
      handleRunnerEvent(event.payload.event);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [handleRunnerEvent, panelId]);

  // Check initial status
  useEffect(() => {
    invoke<string>("claude_status", { panelId }).then((status) => {
      setIsRunning(status === "running");
    });
  }, [panelId]);

  const handleSaveMessage = useCallback(async (messageIndex: number) => {
    const msg = messages[messageIndex];
    if (msg.kind !== "assistant-text") return;

    // Find previous user message
    let userPrompt = "";
    for (let i = messageIndex - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === "user") {
        userPrompt = m.text;
        break;
      }
    }

    if (!userPrompt || !projectId) return;

    try {
      await invoke("history_save", {
        projectId,
        userPrompt,
        assistantResponse: msg.text,
        model: null,
        sessionTabId: panelId,
      });
      notifications.show({
        message: t("history.saved"),
        color: "green",
      });
    } catch (e) {
      notifications.show({
        message: `${t("history.saveError")}: ${e}`,
        color: "red",
      });
    }
  }, [messages, panelId, projectId, t]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!cwd) return;

      // Handle /clear command
      if (text.trim() === "/clear") {
        setMessages([]);
        setSessionResult(null);
        hasSessionRef.current = false;
        return;
      }

      setMessages((prev) => [...prev, { kind: "user", text }]);
      setSessionResult(null);
      setIsRunning(true);
      try {
        await invoke("claude_start", {
          panelId,
          prompt: text,
          cwd,
          mode,
          continueSession: hasSessionRef.current,
          model: projectModel || undefined,
          permissionMode: projectPermissionMode || undefined,
        });
      } catch (err) {
        setIsRunning(false);
        setMessages((prev) => [
          ...prev,
          { kind: "error", text: String(err) },
        ]);
      }
    },
    [cwd, panelId, mode, projectModel, projectPermissionMode],
  );

  const handleStop = useCallback(async () => {
    try {
      await invoke("claude_stop", { panelId });
    } catch (err) {
      console.error("Failed to stop:", err);
    }
  }, [panelId]);

  return (
    <Stack gap={0} style={{ height: "100%", overflow: "hidden" }}>
      {/* Panel toolbar */}
      <Group px="xs" py={4} gap="xs" style={{ borderBottom: "1px solid var(--ucc-border-subtle)" }}>
        <Badge
          size="xs"
          variant="light"
          color={mode === "discuss" ? "blue" : "orange"}
          style={{ textTransform: "uppercase", letterSpacing: 1 }}
        >
          {mode === "discuss" ? t("panel.discuss") : t("panel.code")}
        </Badge>
      </Group>

      {/* Empty state or messages */}
      {messages.length === 0 ? (
        <Stack align="center" justify="center" style={{ flex: 1 }} gap="lg">
          <div
            style={{
              width: 64, height: 64, borderRadius: 16,
              backgroundColor: "rgba(249, 115, 22, 0.06)",
              border: "1px solid var(--ucc-border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {!cwd
              ? <IconFolderOpen size={32} stroke={1.2} color="var(--mantine-color-dimmed)" />
              : <IconMessage size={32} stroke={1.2} color="var(--mantine-color-dimmed)" />
            }
          </div>
          <Text c="dimmed" size="sm">
            {!cwd ? t("chat.selectFolderHint") : t("chat.emptyState")}
          </Text>
        </Stack>
      ) : (
        <MessageList messages={messages} onSaveMessage={projectId ? handleSaveMessage : undefined} />
      )}

      {/* Input */}
      <PromptInput
        isRunning={isRunning || !cwd}
        onSend={handleSend}
        onStop={handleStop}
      />

      {/* Status */}
      <StatusBar isRunning={isRunning} sessionResult={sessionResult} />
    </Stack>
  );
}
