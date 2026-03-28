import { useState, useEffect, useCallback, useRef } from "react";
import { Stack, Group, Text, ActionIcon, Tooltip } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";

import type {
  RunnerEvent,
  ClaudeEvent,
  ChatMessage,
  SessionResult,
} from "../../types/claude";
import { MessageList } from "./MessageList";
import { PromptInput } from "./PromptInput";
import { StatusBar } from "./StatusBar";

export function ChatPanel() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [cwd, setCwd] = useState<string>("");

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
          const info = [
            claudeEvent.model && `Model: ${claudeEvent.model}`,
            claudeEvent.session_id && `Session: ${claudeEvent.session_id.slice(0, 8)}...`,
          ]
            .filter(Boolean)
            .join(" | ");
          if (info) {
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
              return prev;
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
              return prev;
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
          setMessages((prev) => [
            ...prev,
            { kind: "system-info", text: `Rate limited (${info.status}). Resets at: ${info.resetsAt ?? "unknown"}` },
          ]);
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

  // Listen to claude-event
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<RunnerEvent>("claude-event", (event) => {
      handleRunnerEvent(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [handleRunnerEvent]);

  // Check initial status
  useEffect(() => {
    invoke<string>("claude_status").then((status) => {
      setIsRunning(status === "running");
    });
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!cwd) return;
      setMessages((prev) => [...prev, { kind: "user", text }]);
      setSessionResult(null);
      setIsRunning(true);
      try {
        await invoke("claude_start", { prompt: text, cwd, mode: "code" });
      } catch (err) {
        setIsRunning(false);
        setMessages((prev) => [
          ...prev,
          { kind: "error", text: String(err) },
        ]);
      }
    },
    [cwd],
  );

  const handleStop = useCallback(async () => {
    try {
      await invoke("claude_stop");
    } catch (err) {
      console.error("Failed to stop:", err);
    }
  }, []);

  const selectFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) setCwd(selected as string);
  }, []);

  return (
    <Stack gap={0} style={{ height: "calc(100vh - 50px)" }}>
      {/* Folder selector */}
      <Group px="md" py={6} gap="xs" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
        <Tooltip label={t("chat.selectFolder")}>
          <ActionIcon variant="subtle" onClick={selectFolder}>
            <IconFolderOpen size={18} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
        <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
          {cwd || t("chat.noFolder")}
        </Text>
      </Group>

      {/* Messages */}
      <MessageList messages={messages} />

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
