import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Stack,
  Group,
  Title,
  Text,
  Paper,
  Button,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash, IconDownload } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { MarkdownRenderer, ConfirmModal } from "@uni-fw/ui";
import type { SavedMessage } from "../types/claude";

interface HistoryPageProps {
  projectId: string;
}

export function HistoryPage({ projectId }: HistoryPageProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const list = await invoke<SavedMessage[]>("history_list", { projectId });
      setMessages(list);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await invoke("history_delete", { id: deleteId });
      setMessages((prev) => prev.filter((m) => m.id !== deleteId));
      notifications.show({ message: t("history.deleted"), color: "green" });
    } catch (e) {
      console.error("Failed to delete:", e);
    }
    setDeleteId(null);
  }, [deleteId, t]);

  const handleExport = useCallback(async () => {
    try {
      const path = await save({
        defaultPath: "saved-messages.md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (path) {
        await invoke("history_export_to_file", { projectId, filePath: path });
        notifications.show({ message: t("history.exported"), color: "green" });
      }
    } catch (e) {
      notifications.show({
        message: `${t("history.exportError")}: ${e}`,
        color: "red",
      });
    }
  }, [projectId, t]);

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  if (loading) {
    return (
      <Stack p="xl" align="center">
        <Text c="dimmed">{t("common.loading")}</Text>
      </Stack>
    );
  }

  return (
    <Stack p="md" style={{ height: "calc(100vh - 50px)", overflow: "auto" }}>
      <Group justify="space-between">
        <Title order={3}>{t("history.title")}</Title>
        {messages.length > 0 && (
          <Button
            variant="light"
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={handleExport}
          >
            {t("history.exportMarkdown")}
          </Button>
        )}
      </Group>

      {messages.length === 0 ? (
        <Stack align="center" justify="center" style={{ flex: 1 }} gap="md">
          <Text c="dimmed" size="lg">{t("history.noMessages")}</Text>
          <Text c="dimmed" size="sm">{t("history.noMessagesDescription")}</Text>
        </Stack>
      ) : (
        <Stack gap="md">
          {messages.map((msg) => (
            <Paper key={msg.id} p="md" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text size="xs" c="dimmed">{formatDate(msg.createdAt)}</Text>
                  {msg.model && (
                    <Text size="xs" c="dimmed">| {msg.model}</Text>
                  )}
                </Group>
                <Tooltip label={t("history.delete")}>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => setDeleteId(msg.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>

              <Paper p="xs" radius="sm" bg="var(--mantine-color-blue-light)" mb="xs">
                <Text size="xs" fw={600} c="dimmed" mb={4}>{t("history.prompt")}</Text>
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{msg.userPrompt}</Text>
              </Paper>

              <Paper p="xs" radius="sm" bg="var(--mantine-color-default)">
                <Text size="xs" fw={600} c="dimmed" mb={4}>{t("history.response")}</Text>
                <MarkdownRenderer content={msg.assistantResponse} />
              </Paper>
            </Paper>
          ))}
        </Stack>
      )}

      <ConfirmModal
        opened={!!deleteId}
        title={t("history.delete")}
        message={t("history.deleteConfirm")}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </Stack>
  );
}
