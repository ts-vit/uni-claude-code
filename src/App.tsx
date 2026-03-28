import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell, Text, Group, ActionIcon, Tooltip } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { SettingsPage } from "./components/SettingsPage";
import { ChatPanel } from "./components/chat/ChatPanel";

type View = "main" | "settings";

export function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("main");

  return (
    <AppShell header={{ height: 50 }}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={600}>{t("app.title")}</Text>
          <Group gap="xs">
            <Tooltip label={t("common.settings")}>
              <ActionIcon variant="subtle" onClick={() => setView(v => v === "settings" ? "main" : "settings")}>
                <IconSettings size={20} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        {view === "settings" ? (
          <SettingsPage />
        ) : (
          <ChatPanel />
        )}
      </AppShell.Main>
    </AppShell>
  );
}
