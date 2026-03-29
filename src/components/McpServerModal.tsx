import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import type { McpServerEntry } from "../types/claude";

interface McpServerModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: () => void;
  cwd: string;
  editServer?: McpServerEntry | null;
}

interface EnvRow {
  key: string;
  value: string;
}

export function McpServerModal({ opened, onClose, onSave, cwd, editServer }: McpServerModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [scope, setScope] = useState("local");
  const [transport, setTransport] = useState("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [envVars, setEnvVars] = useState<EnvRow[]>([{ key: "", value: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      if (editServer) {
        setName(editServer.name);
        setScope(editServer.scope);
        setTransport(editServer.transport);
        setCommand(editServer.command ?? "");
        setArgs(editServer.args.join(" "));
        setUrl(editServer.url ?? "");
        setEnvVars(
          editServer.env_vars.length > 0
            ? editServer.env_vars.map((e) => ({ key: e.key, value: e.value }))
            : [{ key: "", value: "" }],
        );
      } else {
        setName("");
        setScope("local");
        setTransport("stdio");
        setCommand("");
        setArgs("");
        setUrl("");
        setEnvVars([{ key: "", value: "" }]);
      }
    }
  }, [opened, editServer]);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (transport === "stdio" && !command.trim()) return;
    if (transport !== "stdio" && !url.trim()) return;

    setSaving(true);
    try {
      // If editing, remove first then re-add
      if (editServer) {
        await invoke("mcp_remove", { cwd, name: editServer.name, scope: editServer.scope });
      }

      const envKeys = envVars.filter((e) => e.key.trim()).map((e) => e.key.trim());
      const envValues = envVars.filter((e) => e.key.trim()).map((e) => e.value);
      const argsList = args.trim() ? args.trim().split(/\s+/) : [];

      await invoke("mcp_add", {
        cwd,
        name: name.trim(),
        scope,
        transport,
        command: command.trim(),
        args: argsList,
        url: url.trim(),
        envKeys,
        envValues,
      });

      notifications.show({
        message: t("settings.mcp.addSuccess", { name: name.trim() }),
        color: "green",
      });
      onSave();
      onClose();
    } catch (e) {
      notifications.show({
        message: `${t("settings.mcp.addError")}: ${e}`,
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const addEnvRow = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvRow = (idx: number) => setEnvVars(envVars.filter((_, i) => i !== idx));
  const updateEnvRow = (idx: number, field: "key" | "value", val: string) => {
    const updated = [...envVars];
    updated[idx] = { ...updated[idx], [field]: val };
    setEnvVars(updated);
  };

  const title = editServer ? t("settings.mcp.editServer") : t("settings.mcp.addServer");

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg">
      <Stack gap="md">
        <TextInput
          label={t("settings.mcp.name")}
          placeholder={t("settings.mcp.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          disabled={!!editServer}
          required
        />

        <Group grow>
          <Select
            label={t("settings.mcp.scope")}
            data={[
              { value: "local", label: t("settings.mcp.scopeLabel.local") },
              { value: "project", label: t("settings.mcp.scopeLabel.project") },
              { value: "user", label: t("settings.mcp.scopeLabel.user") },
            ]}
            value={scope}
            onChange={(val) => val && setScope(val)}
            disabled={!!editServer}
          />
          <Select
            label={t("settings.mcp.transport")}
            data={[
              { value: "stdio", label: "stdio" },
              { value: "http", label: "http" },
              { value: "sse", label: "sse" },
            ]}
            value={transport}
            onChange={(val) => val && setTransport(val)}
            disabled={!!editServer}
          />
        </Group>

        {transport === "stdio" ? (
          <>
            <TextInput
              label={t("settings.mcp.command")}
              placeholder={t("settings.mcp.commandPlaceholder")}
              value={command}
              onChange={(e) => setCommand(e.currentTarget.value)}
              required
            />
            <TextInput
              label={t("settings.mcp.args")}
              placeholder={t("settings.mcp.argsPlaceholder")}
              value={args}
              onChange={(e) => setArgs(e.currentTarget.value)}
            />
          </>
        ) : (
          <TextInput
            label={t("settings.mcp.url")}
            placeholder={t("settings.mcp.urlPlaceholder")}
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            required
          />
        )}

        <Stack gap="xs">
          <TextInput
            label={t("settings.mcp.envVars")}
            styles={{ input: { display: "none" } }}
            readOnly
          />
          {envVars.map((row, idx) => (
            <Group key={idx} gap="xs">
              <TextInput
                placeholder={t("settings.mcp.envKey")}
                value={row.key}
                onChange={(e) => updateEnvRow(idx, "key", e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <TextInput
                placeholder={t("settings.mcp.envValue")}
                value={row.value}
                onChange={(e) => updateEnvRow(idx, "value", e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => removeEnvRow(idx)}
                disabled={envVars.length <= 1}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button variant="subtle" size="xs" onClick={addEnvRow}>
            {t("settings.mcp.addEnvVar")}
          </Button>
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="filled" onClick={handleSave} loading={saving}>
            {t("common.save")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
