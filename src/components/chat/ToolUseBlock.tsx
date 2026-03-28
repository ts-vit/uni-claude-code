import { useState } from "react";
import { Paper, Group, Text, Code, UnstyledButton, ThemeIcon, Badge } from "@mantine/core";
import {
  IconFile,
  IconTerminal,
  IconEye,
  IconPencil,
  IconSearch,
  IconFolder,
  IconTool,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ToolResultInfo } from "../../types/claude";

const toolIcons: Record<string, React.ComponentType<{ size?: number; stroke?: number }>> = {
  Write: IconFile,
  Bash: IconTerminal,
  Read: IconEye,
  Edit: IconPencil,
  Grep: IconSearch,
  Glob: IconFolder,
};

interface ToolUseBlockProps {
  toolName: string;
  inputJson: string;
  result?: ToolResultInfo;
}

export function ToolUseBlock({ toolName, inputJson, result }: ToolUseBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const Icon = toolIcons[toolName] || IconTool;

  let parsedInput: Record<string, unknown> | null = null;
  try {
    parsedInput = JSON.parse(inputJson);
  } catch {
    // partial JSON during streaming
  }

  // Show a summary line for common tools
  const summary = parsedInput ? getToolSummary(toolName, parsedInput) : null;

  return (
    <Paper withBorder p="xs" my={4} radius="sm">
      <UnstyledButton onClick={() => setExpanded(!expanded)} w="100%">
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="gray">
            <Icon size={14} stroke={1.5} />
          </ThemeIcon>
          <Text size="sm" fw={500}>
            {toolName}
          </Text>
          {summary && (
            <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
              {summary}
            </Text>
          )}
          {result && (
            <Badge size="xs" color={result.isError ? "red" : "green"} variant="light">
              {result.isError ? t("chat.error") : t("chat.toolResult")}
            </Badge>
          )}
          {expanded ? (
            <IconChevronDown size={14} stroke={1.5} />
          ) : (
            <IconChevronRight size={14} stroke={1.5} />
          )}
        </Group>
      </UnstyledButton>

      {expanded && (
        <>
          <Code block mt="xs" style={{ maxHeight: 300, overflow: "auto", fontSize: "var(--mantine-font-size-xs)" }}>
            {parsedInput ? JSON.stringify(parsedInput, null, 2) : inputJson}
          </Code>
          {result?.content && (
            <Code
              block
              mt={4}
              color={result.isError ? "red" : undefined}
              style={{ maxHeight: 300, overflow: "auto", fontSize: "var(--mantine-font-size-xs)" }}
            >
              {typeof result.content === "string" ? result.content : JSON.stringify(result.content, null, 2)}
            </Code>
          )}
        </>
      )}
    </Paper>
  );
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string | null {
  switch (toolName) {
    case "Read":
    case "Write":
    case "Edit":
      return (input.file_path as string) || null;
    case "Bash":
      return (input.command as string) || null;
    case "Grep":
      return (input.pattern as string) || null;
    case "Glob":
      return (input.pattern as string) || null;
    default:
      return null;
  }
}
