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
