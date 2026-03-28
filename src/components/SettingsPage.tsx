import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, ScrollArea, Stack, TextInput } from "@mantine/core";
import { SshTunnelSettings } from "@uni-fw/ssh-ui";
import { useSettings } from "@uni-fw/ui";
import {
  IconNetwork,
  IconWorld,
} from "@tabler/icons-react";

type SettingsSection = "ssh" | "proxy";

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

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<SettingsSection>("ssh");

  const renderSection = () => {
    switch (activeSection) {
      case "ssh":
        return <SshTunnelSettings />;
      case "proxy":
        return <ProxySettings />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <ScrollArea w={220} p="xs" style={{ borderRight: "1px solid var(--mantine-color-default-border)" }}>
        <Stack gap={2}>
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
        </Stack>
      </ScrollArea>
      <ScrollArea flex={1} p="lg">
        {renderSection()}
      </ScrollArea>
    </div>
  );
}
