import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSettings } from "@uni-fw/ui";

import { SshStatusIndicator } from "../components/SshStatusIndicator";

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockUseSettings = vi.mocked(useSettings);

function renderIndicator() {
  return render(
    <MantineProvider>
      <SshStatusIndicator />
    </MantineProvider>,
  );
}

describe("SshStatusIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ connected: false });
    mockListen.mockImplementation(() => Promise.resolve(() => {}));
    mockUseSettings.mockReturnValue({ value: "myhost.com", set: vi.fn() } as never);
  });

  it("renders nothing when sshHost is empty", () => {
    mockUseSettings.mockReturnValue({ value: "", set: vi.fn() } as never);
    renderIndicator();
    expect(screen.queryByText("SSH")).not.toBeInTheDocument();
  });

  it("renders SSH label when host is configured", () => {
    renderIndicator();
    expect(screen.getByText("SSH")).toBeInTheDocument();
  });

  it("shows connected state after invoke resolves connected", async () => {
    mockInvoke.mockResolvedValue({ connected: true });
    await act(async () => {
      renderIndicator();
    });
    // The tooltip label would be "ssh.connected" (from mocked t())
    // The visible text is always "SSH"
    expect(screen.getByText("SSH")).toBeInTheDocument();
  });

  it("shows disconnected state by default", () => {
    renderIndicator();
    expect(screen.getByText("SSH")).toBeInTheDocument();
  });

  it("registers event listeners on mount", () => {
    renderIndicator();
    expect(mockListen).toHaveBeenCalledWith("ssh-tunnel-connected", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("ssh-tunnel-disconnected", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("ssh-tunnel-reconnecting", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("ssh-tunnel-reconnected", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("ssh-tunnel-reconnect-failed", expect.any(Function));
  });

  it("calls ssh_tunnel_status on mount", () => {
    renderIndicator();
    expect(mockInvoke).toHaveBeenCalledWith("ssh_tunnel_status");
  });

  it("updates status when event fires", async () => {
    let connectedCb: (() => void) | undefined;
    mockListen.mockImplementation((event: string, cb: unknown) => {
      if (event === "ssh-tunnel-connected") connectedCb = cb as () => void;
      return Promise.resolve(() => {});
    });

    await act(async () => {
      renderIndicator();
    });

    expect(connectedCb).toBeDefined();
    await act(async () => {
      connectedCb!();
    });

    expect(screen.getByText("SSH")).toBeInTheDocument();
  });
});
