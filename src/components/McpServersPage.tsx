import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ConfirmModal } from "@uni-fw/ui";
import { useSettings } from "@uni-fw/ui";
import {
  IconPencil,
  IconPlug,
  IconPlugOff,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import type { McpServerEntry } from "../types/claude";
import { McpServerModal } from "./McpServerModal";

const scopeColors: Record<string, string> = {
  user: "blue",
  project: "green",
  local: "gray",
  cloud: "violet",
};

const statusColors: Record<string, string> = {
  connected: "green",
  failed: "red",
  auth_required: "yellow",
  unknown: "gray",
};

export function McpServersPage() {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const { value: cwd } = useSettings("claude.cwd");
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editServer, setEditServer] = useState<McpServerEntry | null>(null);
  const [deleteServer, setDeleteServer] = useState<McpServerEntry | null>(null);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<McpServerEntry[]>("mcp_list", { cwd: cwd ?? "" });
      setServers(result ?? []);
    } catch (e) {
      notifications.show({
        message: `${tRef.current("settings.mcp.loadError")}: ${e}`,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleDelete = async () => {
    if (!deleteServer || !cwd) return;
    try {
      await invoke("mcp_remove", {
        cwd,
        name: deleteServer.name,
        scope: deleteServer.scope,
      });
      notifications.show({
        message: t("settings.mcp.removeSuccess", { name: deleteServer.name }),
        color: "green",
      });
      setDeleteServer(null);
      loadServers();
    } catch (e) {
      notifications.show({
        message: `${t("settings.mcp.removeError")}: ${e}`,
        color: "red",
      });
    }
  };

  const getCommandDisplay = (server: McpServerEntry) => {
    if (server.transport === "stdio") {
      return [server.command, ...server.args].filter(Boolean).join(" ");
    }
    return server.url ?? "";
  };

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={4}>{t("settings.mcp.title")}</Title>
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={loadServers} title={t("settings.mcp.refresh")}>
            <IconRefresh size={18} />
          </ActionIcon>
          <Button
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={() => setAddModalOpen(true)}
          >
            {t("settings.mcp.addServer")}
          </Button>
        </Group>
      </Group>

      {servers.length === 0 ? (
        <Stack align="center" gap="md" py="xl">
          <IconPlugOff size={48} stroke={1.2} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed">{t("settings.mcp.noServers")}</Text>
          <Button
            leftSection={<IconPlug size={16} />}
            variant="light"
            onClick={() => setAddModalOpen(true)}
          >
            {t("settings.mcp.addServer")}
          </Button>
        </Stack>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("settings.mcp.columns.name")}</Table.Th>
              <Table.Th>{t("settings.mcp.columns.type")}</Table.Th>
              <Table.Th>{t("settings.mcp.columns.scope")}</Table.Th>
              <Table.Th>{t("settings.mcp.columns.commandUrl")}</Table.Th>
              <Table.Th>{t("settings.mcp.columns.status")}</Table.Th>
              <Table.Th>{t("settings.mcp.columns.actions")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {servers.map((server) => {
              const cmdDisplay = getCommandDisplay(server);
              const isCloud = server.scope === "cloud";
              return (
                <Table.Tr key={`${server.scope}-${server.name}`}>
                  <Table.Td>{server.name}</Table.Td>
                  <Table.Td>{server.transport}</Table.Td>
                  <Table.Td>
                    <Badge color={scopeColors[server.scope] ?? "gray"} variant="light" size="sm">
                      {t(`settings.mcp.scopeLabel.${server.scope}`)}
                    </Badge>
                  </Table.Td>
                  <Table.Td maw={300}>
                    <Tooltip label={cmdDisplay} disabled={!cmdDisplay}>
                      <Text size="sm" truncate>
                        {cmdDisplay || "—"}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={statusColors[server.status] ?? "gray"}
                      variant="light"
                      size="sm"
                    >
                      {t(`settings.mcp.status.${server.status}`)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => setEditServer(server)}
                        disabled={isCloud}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => setDeleteServer(server)}
                        disabled={isCloud}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <McpServerModal
        opened={addModalOpen || !!editServer}
        onClose={() => {
          setAddModalOpen(false);
          setEditServer(null);
        }}
        onSave={loadServers}
        cwd={cwd ?? ""}
        editServer={editServer}
      />

      <ConfirmModal
        opened={!!deleteServer}
        onClose={() => setDeleteServer(null)}
        onConfirm={handleDelete}
        title={t("settings.mcp.deleteServer")}
        message={t("settings.mcp.deleteConfirm", { name: deleteServer?.name })}
      />
    </Stack>
  );
}
