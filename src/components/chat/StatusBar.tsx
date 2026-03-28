import { Group, Text, Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { SessionResult } from "../../types/claude";

interface StatusBarProps {
  isRunning: boolean;
  sessionResult: SessionResult | null;
}

export function StatusBar({ isRunning, sessionResult }: StatusBarProps) {
  const { t } = useTranslation();

  return (
    <Group
      px="md"
      py={6}
      gap="md"
      style={{
        borderTop: "1px solid var(--mantine-color-default-border)",
        fontSize: "var(--mantine-font-size-xs)",
      }}
    >
      <Badge
        size="sm"
        variant="dot"
        color={isRunning ? "blue" : "gray"}
      >
        {isRunning ? t("chat.running") : t("chat.idle")}
      </Badge>

      {sessionResult && (
        <>
          {sessionResult.cost != null && sessionResult.cost > 0 && (
            <Text size="xs" c="dimmed">
              {t("chat.cost")}: ${sessionResult.cost.toFixed(4)}
            </Text>
          )}
          {sessionResult.durationMs != null && (
            <Text size="xs" c="dimmed">
              {t("chat.duration")}: {(sessionResult.durationMs / 1000).toFixed(1)}s
            </Text>
          )}
          {sessionResult.numTurns != null && (
            <Text size="xs" c="dimmed">
              {t("chat.turns")}: {sessionResult.numTurns}
            </Text>
          )}
        </>
      )}
    </Group>
  );
}
