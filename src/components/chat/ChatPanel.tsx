import { useState, useEffect, useCallback, useRef } from "react";
import { Stack, Group, Text, Badge } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFolderOpen, IconMessage } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
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
import { useTauriListener } from "../../utils/safeListener";

interface ChatPanelProps {
  panelId?: string;
  mode?: string;
  cwd: string;
  projectId?: string;
  projectModel?: string | null;
  projectPermissionMode?: string;
  isActive?: boolean;
}

const MAX_MESSAGES_IN_MEMORY = 200;
const LOAD_EARLIER_BATCH_SIZE = 100;
const INACTIVE_VISIBLE_MESSAGES = 20;

export function ChatPanel({
  panelId = "code",
  mode = "code",
  cwd,
  projectId,
  projectModel,
  projectPermissionMode,
  isActive = true,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

  const hasSessionRef = useRef(false);
  const currentBlockIndexRef = useRef<number>(-1);
  const toolJsonBuffersRef = useRef<Map<number, string>>(new Map());
  const archivedMessagesRef = useRef<ChatMessage[]>([]);
  const nextMessageIdRef = useRef(0);
  const streamBufferRef = useRef("");
  const rafIdRef = useRef<number | null>(null);

  const createMessageId = useCallback(() => `${panelId}-${nextMessageIdRef.current++}`, [panelId]);

  const applyMemoryLimit = useCallback((nextMessages: ChatMessage[]) => {
    const last = nextMessages[nextMessages.length - 1];
    const limit = last?.kind === "assistant-text" && last.streaming
      ? MAX_MESSAGES_IN_MEMORY + 1
      : MAX_MESSAGES_IN_MEMORY;

    if (nextMessages.length <= limit) {
      return nextMessages;
    }

    const overflowCount = nextMessages.length - limit;
    archivedMessagesRef.current = [
      ...archivedMessagesRef.current,
      ...nextMessages.slice(0, overflowCount),
    ];

    return nextMessages.slice(overflowCount);
  }, []);

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => applyMemoryLimit(updater(prev)));
  }, [applyMemoryLimit]);

  const resetStreamingState = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    streamBufferRef.current = "";
    currentBlockIndexRef.current = -1;
    toolJsonBuffersRef.current.clear();
  }, []);

  const flushStreamBuffer = useCallback(() => {
    const chunk = streamBufferRef.current;
    if (!chunk) {
      return;
    }

    streamBufferRef.current = "";
    updateMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.kind === "assistant-text" && last.streaming) {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, text: last.text + chunk };
        return updated;
      }

      return [
        ...prev,
        { id: createMessageId(), kind: "assistant-text", text: chunk, streaming: true },
      ];
    });
  }, [createMessageId, updateMessages]);

  const scheduleStreamFlush = useCallback(() => {
    if (rafIdRef.current !== null) {
      return;
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      flushStreamBuffer();
    });
  }, [flushStreamBuffer]);

  const finalizeStreaming = useCallback(() => {
    flushStreamBuffer();
    updateMessages((prev) =>
      prev.map((m) =>
        m.kind === "assistant-text" && m.streaming ? { ...m, streaming: false } : m,
      ),
    );
    resetStreamingState();
  }, [flushStreamBuffer, resetStreamingState, updateMessages]);

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
            updateMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.kind === "system-info" && last.text === info) {
                return prev;
              }
              return [...prev, { id: createMessageId(), kind: "system-info", text: info }];
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
                updateMessages((prev) => [
                  ...prev,
                  {
                    id: createMessageId(),
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
                streamBufferRef.current += delta.text;
                scheduleStreamFlush();
              } else if (delta.type === "input_json_delta") {
                const current = (toolJsonBuffersRef.current.get(event.index) || "") + delta.partial_json;
                toolJsonBuffersRef.current.set(event.index, current);
                updateMessages((prev) => {
                  const updated = [...prev];
                  for (let i = updated.length - 1; i >= 0; i--) {
                    const msg = updated[i];
                    if (msg.kind === "tool-use" && !msg.result) {
                      updated[i] = { ...msg, inputJson: current };
                      break;
                    }
                  }
                  return updated;
                });
              }
              break;
            }

            case "content_block_stop": {
              flushStreamBuffer();
              updateMessages((prev) => {
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
          if (claudeEvent.message?.content) {
            for (const block of claudeEvent.message.content) {
              if (block.type === "tool_result") {
                updateMessages((prev) => {
                  const updated = [...prev];
                  for (let i = updated.length - 1; i >= 0; i--) {
                    const msg = updated[i];
                    if (msg.kind === "tool-use" && msg.toolId === block.tool_use_id && !msg.result) {
                      updated[i] = {
                        ...msg,
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
          const textBlocks = claudeEvent.message.content
            .filter((b): b is { type: "text"; text: string } => b.type === "text")
            .map((b) => b.text)
            .join("");

          if (textBlocks) {
            updateMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.kind === "assistant-text") {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, text: textBlocks, streaming: false };
                return updated;
              }
              return [...prev, { id: createMessageId(), kind: "assistant-text", text: textBlocks, streaming: false }];
            });
          }

          resetStreamingState();
          break;
        }

        case "result": {
          if (claudeEvent.result) {
            updateMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.kind === "assistant-text") {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, text: claudeEvent.result!, streaming: false };
                return updated;
              }
              return [...prev, { id: createMessageId(), kind: "assistant-text", text: claudeEvent.result!, streaming: false }];
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
            updateMessages((prev) => [
              ...prev,
              { id: createMessageId(), kind: "error", text: `Rate limited (${info.status}). Resets at: ${resetsAtStr}` },
            ]);
          }
          break;
        }
      }
    },
    [createMessageId, finalizeStreaming, flushStreamBuffer, resetStreamingState, scheduleStreamFlush, updateMessages],
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
          updateMessages((prev) => [
            ...prev,
            { id: createMessageId(), kind: "system-info", text: t("chat.processExited", { code }) },
          ]);
        }
      }
    },
    [createMessageId, finalizeStreaming, handleClaudeEvent, t, updateMessages],
  );

  useTauriListener<PanelEvent>(
    "claude-event",
    (event) => {
      if (event.payload.panel_id !== panelId) {
        return;
      }
      handleRunnerEvent(event.payload.event);
    },
    [handleRunnerEvent, panelId],
  );

  useEffect(() => {
    invoke<string>("claude_status", { panelId }).then((status) => {
      setIsRunning(status === "running");
    });
  }, [panelId]);

  useEffect(() => () => {
    resetStreamingState();
  }, [resetStreamingState]);

  const handleSaveMessage = useCallback(async (messageIndex: number) => {
    const msg = messages[messageIndex];
    if (!msg || msg.kind !== "assistant-text") return;

    let userPrompt = "";
    for (let i = messageIndex - 1; i >= 0; i--) {
      const candidate = messages[i];
      if (candidate.kind === "user") {
        userPrompt = candidate.text;
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

      if (text.trim() === "/clear") {
        setMessages([]);
        setSessionResult(null);
        hasSessionRef.current = false;
        archivedMessagesRef.current = [];
        resetStreamingState();
        return;
      }

      updateMessages((prev) => [...prev, { id: createMessageId(), kind: "user", text }]);
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
        updateMessages((prev) => [
          ...prev,
          { id: createMessageId(), kind: "error", text: String(err) },
        ]);
      }
    },
    [createMessageId, cwd, mode, panelId, projectModel, projectPermissionMode, resetStreamingState, updateMessages],
  );

  const handleStop = useCallback(async () => {
    try {
      await invoke("claude_stop", { panelId });
    } catch (err) {
      console.error("Failed to stop:", err);
    }
  }, [panelId]);

  const handleLoadEarlier = useCallback(() => {
    if (archivedMessagesRef.current.length === 0) {
      return;
    }

    const chunkSize = Math.min(LOAD_EARLIER_BATCH_SIZE, archivedMessagesRef.current.length);
    const restoredMessages = archivedMessagesRef.current.slice(-chunkSize);
    archivedMessagesRef.current = archivedMessagesRef.current.slice(0, -chunkSize);

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      const limit = last?.kind === "assistant-text" && last.streaming
        ? MAX_MESSAGES_IN_MEMORY + 1
        : MAX_MESSAGES_IN_MEMORY;
      const keepCount = Math.max(0, limit - restoredMessages.length);
      return [...restoredMessages, ...prev.slice(-keepCount)];
    });
  }, []);

  const renderedMessages = isActive ? messages : messages.slice(-INACTIVE_VISIBLE_MESSAGES);

  return (
    <Stack gap={0} style={{ height: "100%", overflow: "hidden" }}>
      <Group px="xs" py={4} gap="xs" style={{ borderBottom: "1px solid var(--ucc-border-subtle)" }}>
        <Badge
          size="xs"
          variant="light"
          color={mode === "code" ? "orange" : "blue"}
          style={{ textTransform: "uppercase", letterSpacing: 1 }}
        >
          {t(mode === "code" ? "panel.modeDeveloper" : "panel.modeArchitect")}
        </Badge>
      </Group>

      {messages.length === 0 ? (
        <Stack align="center" justify="center" style={{ flex: 1 }} gap="lg">
          {mode !== "discuss" && (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: "rgba(249, 115, 22, 0.06)",
                border: "1px solid var(--ucc-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!cwd
                ? <IconFolderOpen size={32} stroke={1.2} color="var(--mantine-color-dimmed)" />
                : <IconMessage size={32} stroke={1.2} color="var(--mantine-color-dimmed)" />
              }
            </div>
          )}
          {mode !== "discuss" && (
            <Text c="dimmed" size="sm">
              {!cwd ? t("chat.selectFolderHint") : t("chat.emptyState")}
            </Text>
          )}
          {mode === "discuss" && !cwd && (
            <Text c="dimmed" size="sm">
              {t("chat.selectFolderHint")}
            </Text>
          )}
        </Stack>
      ) : (
        <MessageList
          messages={renderedMessages}
          onSaveMessage={projectId ? handleSaveMessage : undefined}
          hasEarlierMessages={isActive && archivedMessagesRef.current.length > 0}
          onLoadEarlier={isActive ? handleLoadEarlier : undefined}
          enabled={isActive}
        />
      )}

      <PromptInput
        isRunning={isRunning || !cwd}
        onSend={handleSend}
        onStop={handleStop}
        placeholder={mode === "discuss" ? t("chat.placeholderArchitect") : undefined}
      />

      <StatusBar isRunning={isRunning} sessionResult={sessionResult} />
    </Stack>
  );
}
