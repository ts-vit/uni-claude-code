import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Group, Text, Tooltip } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSettings } from "@uni-fw/ui";

type SshStatus = "connected" | "disconnected" | "reconnecting";

export function SshStatusIndicator() {
  const { t } = useTranslation();
  const { value: sshHost } = useSettings("ssh.host");
  const [status, setStatus] = useState<SshStatus>("disconnected");

  useEffect(() => {
    invoke("ssh_tunnel_status")
      .then((s: unknown) => {
        const st = s as { connected: boolean };
        setStatus(st.connected ? "connected" : "disconnected");
      })
      .catch(() => {});

    const unlisteners = [
      listen("ssh-tunnel-connected", () => setStatus("connected")),
      listen("ssh-tunnel-disconnected", () => setStatus("disconnected")),
      listen("ssh-tunnel-reconnecting", () => setStatus("reconnecting")),
      listen("ssh-tunnel-reconnected", () => setStatus("connected")),
      listen("ssh-tunnel-reconnect-failed", () => setStatus("disconnected")),
    ];

    return () => {
      unlisteners.forEach((p) => p.then((unlisten) => unlisten()));
    };
  }, []);

  if (!sshHost) return null;

  const color =
    status === "connected"
      ? "var(--mantine-color-green-6)"
      : status === "reconnecting"
        ? "var(--mantine-color-yellow-6)"
        : "var(--mantine-color-gray-5)";

  const label =
    status === "connected"
      ? t("ssh.connected")
      : status === "reconnecting"
        ? "SSH Reconnecting..."
        : t("ssh.disconnected");

  return (
    <Tooltip label={label}>
      <Group gap={4} style={{ cursor: "default" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: color,
            display: "inline-block",
          }}
        />
        <Text size="sm" c="dimmed">
          SSH
        </Text>
      </Group>
    </Tooltip>
  );
}
