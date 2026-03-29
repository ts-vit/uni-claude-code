import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

vi.mock("@uni-fw/ssh-ui", () => ({
  SshTunnelSettings: () => null,
  useSshTunnel: () => ({ status: { connected: false } }),
}));

vi.mock("../i18n/i18n", () => ({
  default: { language: "en", changeLanguage: vi.fn() },
}));

import { SettingsPage } from "../components/SettingsPage";

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders General section by default", () => {
    renderWithMantine(<SettingsPage />);
    expect(screen.getByText("settings.general.title")).toBeInTheDocument();
  });

  it("shows language selector", () => {
    renderWithMantine(<SettingsPage />);
    expect(screen.getByText("settings.general.language")).toBeInTheDocument();
  });

  it("renders all nav items", () => {
    renderWithMantine(<SettingsPage />);
    expect(screen.getByText("settings.nav.general")).toBeInTheDocument();
    expect(screen.getByText("settings.nav.vpn")).toBeInTheDocument();
    expect(screen.getByText("settings.nav.proxy")).toBeInTheDocument();
    expect(screen.getByText("settings.nav.claude")).toBeInTheDocument();
    expect(screen.getByText("settings.nav.mcp")).toBeInTheDocument();
  });
});
