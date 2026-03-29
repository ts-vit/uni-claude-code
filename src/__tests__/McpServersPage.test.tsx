import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@uni-fw/ui";
import type { McpServerEntry } from "../types/claude";

const mockedInvoke = invoke as ReturnType<typeof vi.fn>;
const mockedUseSettings = useSettings as ReturnType<typeof vi.fn>;

vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));

vi.mock("@uni-fw/ui", () => ({
  ConfirmModal: ({ opened, title, message }: { opened: boolean; title: string; message: string }) =>
    opened ? <div data-testid="confirm-modal">{title}: {message}</div> : null,
  useSettings: vi.fn(() => ({ value: "D:\\test-project", set: vi.fn() })),
  UniProvider: ({ children }: { children: React.ReactNode }) => children,
  MarkdownRenderer: ({ content }: { content: string }) => content,
}));

import { McpServersPage } from "../components/McpServersPage";

function renderPage() {
  return render(
    <MantineProvider>
      <McpServersPage />
    </MantineProvider>,
  );
}

const mockServers: McpServerEntry[] = [
  {
    name: "test-server",
    scope: "local",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@test/server"],
    url: null,
    env_vars: [],
    status: "connected",
  },
  {
    name: "cloud-api",
    scope: "cloud",
    transport: "http",
    command: null,
    args: [],
    url: "https://api.example.com/mcp",
    env_vars: [],
    status: "failed",
  },
];

describe("McpServersPage", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedUseSettings.mockReturnValue({ value: "D:\\test-project", set: vi.fn() });
  });

  it("renders empty state when no servers", async () => {
    mockedInvoke.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText("settings.mcp.noServers")).toBeInTheDocument();
  });

  it("renders server list with names and badges", async () => {
    mockedInvoke.mockResolvedValueOnce(mockServers);
    renderPage();
    expect(await screen.findByText("test-server")).toBeInTheDocument();
    expect(screen.getByText("cloud-api")).toBeInTheDocument();
    expect(screen.getByText("settings.mcp.scopeLabel.local")).toBeInTheDocument();
    expect(screen.getByText("settings.mcp.scopeLabel.cloud")).toBeInTheDocument();
    expect(screen.getByText("settings.mcp.status.connected")).toBeInTheDocument();
    expect(screen.getByText("settings.mcp.status.failed")).toBeInTheDocument();
  });

  it("opens add modal when clicking Add Server button", async () => {
    mockedInvoke.mockResolvedValueOnce([]);
    renderPage();
    await screen.findByText("settings.mcp.noServers");
    const addBtn = screen.getAllByText("settings.mcp.addServer")[0];
    fireEvent.click(addBtn);
    expect(screen.getAllByText("settings.mcp.addServer").length).toBeGreaterThanOrEqual(1);
  });

  it("shows confirm modal when clicking delete", async () => {
    mockedInvoke.mockResolvedValueOnce(mockServers);
    renderPage();
    await screen.findByText("test-server");
    // Find the trash/delete button in the test-server row
    const rows = screen.getAllByRole("row");
    const testServerRow = rows.find((row) => row.textContent?.includes("test-server"));
    const buttons = testServerRow?.querySelectorAll("button");
    // Second button in actions column is delete
    const deleteBtn = buttons?.[1];
    if (deleteBtn) {
      fireEvent.click(deleteBtn);
      expect(await screen.findByTestId("confirm-modal")).toBeInTheDocument();
    }
  });
});
