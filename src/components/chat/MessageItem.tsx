import React, { useMemo } from "react";
import { ActionIcon, Code, Paper, Text, Tooltip } from "@mantine/core";
import { IconBookmark } from "@tabler/icons-react";
import { MarkdownRenderer } from "@uni-fw/ui";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "../../types/claude";
import { ToolUseBlock } from "./ToolUseBlock";

interface MessageItemProps {
  message: ChatMessage;
  onSave?: () => void;
}

function MessageItemInner({ message, onSave }: MessageItemProps) {
  const { t } = useTranslation();
  const renderedAssistantContent = useMemo(() => {
    if (message.kind !== "assistant-text") {
      return null;
    }
    return <MarkdownRenderer content={message.text} />;
  }, [message.kind, message.kind === "assistant-text" ? message.text : ""]);

  switch (message.kind) {
    case "user":
      return (
        <Paper
          p="sm"
          radius="md"
          bg="var(--ucc-bg-chat-user)"
          style={{ alignSelf: "flex-end", maxWidth: "85%" }}
        >
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {message.text}
          </Text>
        </Paper>
      );

    case "assistant-text":
      return (
        <Paper p="sm" radius="md" bg="var(--ucc-bg-chat-assistant)" style={{ maxWidth: "95%", position: "relative" }}>
          {renderedAssistantContent}
          {message.streaming && (
            <Text component="span" size="sm" style={{ opacity: 0.5 }}>|</Text>
          )}
          {!message.streaming && onSave && (
            <Tooltip label={t("history.save")} position="left">
              <ActionIcon
                variant="subtle"
                size="xs"
                onClick={onSave}
                aria-label={t("history.save")}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  opacity: 0.4,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
              >
                <IconBookmark size={14} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
          )}
        </Paper>
      );

    case "tool-use":
      return (
        <ToolUseBlock
          toolName={message.toolName}
          inputJson={message.inputJson}
          result={message.result}
        />
      );

    case "error":
      return (
        <Code block color="red" style={{ fontSize: "var(--mantine-font-size-xs)" }}>
          {message.text}
        </Code>
      );

    case "system-info":
      return (
        <Text size="xs" c="dimmed" ta="center" py={4}>
          {message.text}
        </Text>
      );
  }
}

export const MessageItem = React.memo(MessageItemInner, (prev, next) => {
  if (prev.onSave !== next.onSave) {
    return false;
  }

  if (prev.message.kind !== next.message.kind) {
    return false;
  }

  if (prev.message.id !== next.message.id) {
    return false;
  }

  switch (prev.message.kind) {
    case "assistant-text":
      return (
        next.message.kind === "assistant-text"
        && prev.message.text === next.message.text
        && prev.message.streaming === next.message.streaming
      );
    case "user":
      return next.message.kind === "user" && prev.message.text === next.message.text;
    case "error":
      return next.message.kind === "error" && prev.message.text === next.message.text;
    case "system-info":
      return next.message.kind === "system-info" && prev.message.text === next.message.text;
    case "tool-use":
      return (
        next.message.kind === "tool-use"
        && prev.message.toolId === next.message.toolId
        && prev.message.toolName === next.message.toolName
        && prev.message.inputJson === next.message.inputJson
        && prev.message.result === next.message.result
      );
  }
});
