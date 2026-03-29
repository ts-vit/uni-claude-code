import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, Badge } from "@mantine/core";
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

  const label =
    status === "connected"
      ? t("ssh.connected")
      : status === "reconnecting"
        ? "SSH Reconnecting..."
        : t("ssh.disconnected");

  return (
    <Tooltip label={label}>
      {status === "connected" ? (
        <Badge
          size="sm" variant="outline" color="green" radius="xl"
          leftSection={
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              backgroundColor: "var(--mantine-color-green-6)",
              display: "inline-block",
              boxShadow: "var(--ucc-shadow-glow-green)",
            }} />
          }
          styles={{ root: { borderColor: "rgba(34, 197, 94, 0.3)", backgroundColor: "rgba(34, 197, 94, 0.06)" } }}
        >
          SSH
        </Badge>
      ) : (
        <Badge
          size="sm" variant="outline" color="gray" radius="xl"
          leftSection={
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              backgroundColor: "var(--mantine-color-gray-6)",
              display: "inline-block",
            }} />
          }
          styles={{ root: { borderColor: "var(--ucc-border-subtle)", backgroundColor: "transparent" } }}
        >
          SSH
        </Badge>
      )}
    </Tooltip>
  );
}
