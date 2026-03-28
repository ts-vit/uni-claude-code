import { Paper, Text, Code } from "@mantine/core";
import { MarkdownRenderer } from "@uni-fw/ui";
import type { ChatMessage } from "../../types/claude";
import { ToolUseBlock } from "./ToolUseBlock";

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  switch (message.kind) {
    case "user":
      return (
        <Paper
          p="sm"
          radius="md"
          bg="var(--mantine-color-blue-light)"
          style={{ alignSelf: "flex-end", maxWidth: "85%" }}
        >
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {message.text}
          </Text>
        </Paper>
      );

    case "assistant-text":
      return (
        <Paper p="sm" radius="md" bg="var(--mantine-color-default)" style={{ maxWidth: "95%" }}>
          <MarkdownRenderer content={message.text} />
          {message.streaming && (
            <Text component="span" size="sm" style={{ opacity: 0.5 }}>|</Text>
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
