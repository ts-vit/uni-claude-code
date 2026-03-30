import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionIcon, NavLink, NumberInput, ScrollArea, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { SshTunnelSettings, useSshTunnel } from "@uni-fw/ssh-ui";
import { useSettings } from "@uni-fw/ui";
import {
  IconFolderOpen,
  IconNetwork,
  IconPlug,
  IconRobot,
  IconSettings,
  IconWorld,
} from "@tabler/icons-react";
import { open } from "@tauri-apps/plugin-dialog";
import { McpServersPage } from "./McpServersPage";
import i18n from "../i18n/i18n";

type SettingsSection = "general" | "ssh" | "proxy" | "claude" | "mcp";

function PortForwardSettings() {
  const { t } = useTranslation();
  const remotePort = useSettings("ssh.forward_remote_port");
  const remoteHost = useSettings("ssh.forward_remote_host");

  return (
    <Stack gap="md" maw={480} mt="lg">
      <Text size="sm" c="dimmed">{t("settings.vpn.ssh.forwardDescription")}</Text>
      <NumberInput
        label={t("settings.vpn.ssh.forwardRemotePort")}
        placeholder="8888"
        min={1}
        max={65535}
        value={remotePort.value ? Number(remotePort.value) : ""}
        onChange={(val) => remotePort.set(val ? String(val) : "")}
      />
      <TextInput
        label={t("settings.vpn.ssh.forwardRemoteHost")}
        placeholder="127.0.0.1"
        value={remoteHost.value ?? ""}
        onChange={(e) => remoteHost.set(e.currentTarget.value)}
      />
    </Stack>
  );
}

function SshSection() {
  const { t } = useTranslation();
  const remotePort = useSettings("ssh.forward_remote_port");
  const remoteHost = useSettings("ssh.forward_remote_host");
  const tunnel = useSshTunnel(t);

  const extraConnectParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    const rp = remotePort.value ? Number(remotePort.value) : 0;
    if (rp > 0) {
      params.forwardRemotePort = rp;
      params.forwardRemoteHost = remoteHost.value || "127.0.0.1";
    }
    return Object.keys(params).length > 0 ? params : undefined;
  }, [remotePort.value, remoteHost.value]);

  const proxyUrlOverride = useMemo(() => {
    const rp = remotePort.value ? Number(remotePort.value) : 0;
    if (rp > 0 && tunnel.status.connected && tunnel.status.localPort) {
      return `http://127.0.0.1:${tunnel.status.localPort}`;
    }
    return undefined;
  }, [remotePort.value, tunnel.status.connected, tunnel.status.localPort]);

  return (
    <>
      <SshTunnelSettings
        extraConnectParams={extraConnectParams}
        proxyUrlOverride={proxyUrlOverride}
      />
      <PortForwardSettings />
    </>
  );
}

function ProxySettings() {
  const { t } = useTranslation();
  const { value, set } = useSettings("httpProxy");

  return (
    <Stack gap="md" maw={480}>
      <TextInput
        label={t("settings.proxy.httpProxy")}
        description={t("settings.proxy.httpProxyDescription")}
        placeholder="http://127.0.0.1:12334"
        value={value ?? ""}
        onChange={(e) => set(e.currentTarget.value)}
      />
    </Stack>
  );
}

function GeneralSettings() {
  const { t } = useTranslation();

  return (
    <Stack gap="lg">
      <Title order={4}>{t("settings.general.title")}</Title>
      <Select
        label={t("settings.general.language")}
        description={t("settings.general.languageDescription")}
        data={[
          { value: "en", label: "English" },
          { value: "ru", label: "Русский" },
        ]}
        value={i18n.language}
        onChange={(val) => {
          if (val) {
            i18n.changeLanguage(val);
            localStorage.setItem("uni-claude-code-language", val);
          }
        }}
        maw={480}
      />
    </Stack>
  );
}

function ClaudeSettings() {
  const { t } = useTranslation();
  const claudePath = useSettings("claude.path");
  const model = useSettings("claude.model");
  const savedCwd = useSettings("claude.cwd");

  return (
    <Stack gap="lg">
      <Title order={4}>{t("settings.claude.title")}</Title>

      <TextInput
        label={t("settings.claude.path")}
        description={t("settings.claude.pathDescription")}
        placeholder="claude"
        value={claudePath.value ?? ""}
        onBlur={(e) => claudePath.set(e.currentTarget.value)}
        maw={480}
      />

      <Select
        label={t("settings.claude.model")}
        description={t("settings.claude.modelDescription")}
        placeholder="claude-sonnet-4-6"
        data={[
          { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
          { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
          { value: "sonnet", label: "Sonnet (latest)" },
          { value: "opus", label: "Opus (latest)" },
          { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
        ]}
        value={model.value ?? ""}
        onChange={(val) => model.set(val ?? "")}
        searchable
        clearable
        allowDeselect
        maw={480}
      />

      <TextInput
        label={t("settings.claude.defaultCwd")}
        description={t("settings.claude.defaultCwdDescription")}
        placeholder="D:\\work-ai\\my-project"
        value={savedCwd.value ?? ""}
        onBlur={(e) => savedCwd.set(e.currentTarget.value)}
        rightSection={
          <ActionIcon variant="subtle" onClick={async () => {
            const selected = await open({ directory: true });
            if (selected) savedCwd.set(selected as string);
          }}>
            <IconFolderOpen size={16} stroke={1.5} />
          </ActionIcon>
        }
        maw={480}
      />
    </Stack>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  const renderSection = () => {
    switch (activeSection) {
      case "general":
        return <GeneralSettings />;
      case "ssh":
        return <SshSection />;
      case "proxy":
        return <ProxySettings />;
      case "claude":
        return <ClaudeSettings />;
      case "mcp":
        return <McpServersPage />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <ScrollArea w={220} p="xs" style={{ borderRight: "1px solid var(--ucc-border-subtle)" }}>
        <Stack gap={2}>
          <NavLink
            label={t("settings.nav.general")}
            leftSection={<IconSettings size={18} stroke={1.5} />}
            active={activeSection === "general"}
            onClick={() => setActiveSection("general")}
          />
          <NavLink
            label={t("settings.nav.vpn")}
            leftSection={<IconNetwork size={18} stroke={1.5} />}
            active={activeSection === "ssh"}
            onClick={() => setActiveSection("ssh")}
          />
          <NavLink
            label={t("settings.nav.proxy")}
            leftSection={<IconWorld size={18} stroke={1.5} />}
            active={activeSection === "proxy"}
            onClick={() => setActiveSection("proxy")}
          />
          <NavLink
            label={t("settings.nav.claude")}
            leftSection={<IconRobot size={18} stroke={1.5} />}
            active={activeSection === "claude"}
            onClick={() => setActiveSection("claude")}
          />
          <NavLink
            label={t("settings.nav.mcp")}
            leftSection={<IconPlug size={18} stroke={1.5} />}
            active={activeSection === "mcp"}
            onClick={() => setActiveSection("mcp")}
          />
        </Stack>
      </ScrollArea>
      <ScrollArea flex={1} p="lg">
        {renderSection()}
      </ScrollArea>
    </div>
  );
}
