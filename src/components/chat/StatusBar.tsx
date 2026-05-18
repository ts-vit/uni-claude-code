import { Group, Text, Badge, ActionIcon, Tooltip, CopyButton, Stack } from "@mantine/core";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { SessionResult, Usage } from "../../types/claude";

interface StatusBarProps {
  isRunning: boolean;
  sessionResult: SessionResult | null;
  model: string | null;
  sessionId: string | null;
  usage: Usage | null;
}

export function StatusBar({ isRunning, sessionResult, model, sessionId, usage }: StatusBarProps) {
  const { t } = useTranslation();

  const tokenSum =
    usage !== null
      ? usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
      : null;

  return (
    <Group
      px="md" py={6} gap="md"
      style={{
        borderTop: "1px solid var(--ucc-border-subtle)",
        fontSize: "var(--mantine-font-size-xs)",
        backgroundColor: "var(--ucc-bg-sidebar)",
      }}
    >
      <Badge
        size="sm" variant="outline" radius="xl"
        color={isRunning ? "blue" : "gray"}
        leftSection={
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            backgroundColor: isRunning ? "var(--mantine-color-blue-5)" : "var(--mantine-color-gray-6)",
            display: "inline-block",
            animation: isRunning ? "pulse 1.5s ease-in-out infinite" : "none",
          }} />
        }
        styles={{
          root: {
            borderColor: isRunning ? "rgba(59, 130, 246, 0.3)" : "var(--ucc-border-subtle)",
            backgroundColor: isRunning ? "rgba(59, 130, 246, 0.06)" : "transparent",
          },
        }}
      >
        {isRunning ? t("chat.running") : t("chat.idle")}
      </Badge>
      <Text size="xs" c="dimmed">{t("chat.model")}: {model ?? "—"}</Text>
      <>
        <Text size="xs" c="dimmed">{t("chat.session")}: {sessionId ? `${sessionId.slice(0, 8)}...` : "—"}</Text>
        {sessionId !== null && (
          <CopyButton value={sessionId} timeout={1500}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? t("chat.copied") : t("chat.copySessionId")} withArrow position="top">
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  color={copied ? "teal" : "gray"}
                  onClick={copy}
                  aria-label={t("chat.copySessionId")}
                >
                  {copied ? <IconCheck size={12} stroke={1.5} /> : <IconCopy size={12} stroke={1.5} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        )}
      </>
      {usage !== null ? (
        <Tooltip
          withArrow
          position="top"
          label={
            <Stack gap={2}>
              <Text size="xs">{t("chat.tokensTooltip.input")}: {usage.input_tokens.toLocaleString()}</Text>
              <Text size="xs">{t("chat.tokensTooltip.output")}: {usage.output_tokens.toLocaleString()}</Text>
              <Text size="xs">{t("chat.tokensTooltip.cacheCreation")}: {usage.cache_creation_input_tokens.toLocaleString()}</Text>
              <Text size="xs">{t("chat.tokensTooltip.cacheRead")}: {usage.cache_read_input_tokens.toLocaleString()}</Text>
            </Stack>
          }
        >
          <Text size="xs" c="dimmed" style={{ cursor: "default" }}>{t("chat.tokens")}: {tokenSum!.toLocaleString()}</Text>
        </Tooltip>
      ) : (
        <Text size="xs" c="dimmed">{t("chat.tokens")}: {"—"}</Text>
      )}
      {sessionResult && (
        <>
          {sessionResult.cost != null && sessionResult.cost > 0 && (
            <Text size="xs" c="dimmed">{t("chat.cost")}: ${sessionResult.cost.toFixed(4)}</Text>
          )}
          {sessionResult.durationMs != null && (
            <Text size="xs" c="dimmed">{t("chat.duration")}: {(sessionResult.durationMs / 1000).toFixed(1)}s</Text>
          )}
          {sessionResult.numTurns != null && (
            <Text size="xs" c="dimmed">{t("chat.turns")}: {sessionResult.numTurns}</Text>
          )}
        </>
      )}
    </Group>
  );
}
