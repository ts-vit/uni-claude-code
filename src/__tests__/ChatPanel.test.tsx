import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ChatPanel } from "../components/chat/ChatPanel";
import type { PanelEvent } from "../types/claude";

// jsdom doesn't have ResizeObserver — Mantine ScrollArea needs it
(globalThis as Record<string, unknown>).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);
const mockedListen = vi.mocked(listen);

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvoke.mockResolvedValue("idle");
    mockedListen.mockImplementation(() => Promise.resolve(() => {}));
  });

  it("renders with default panelId='code'", () => {
    renderWithMantine(<ChatPanel cwd="D:\\test" />);
    expect(mockedInvoke).toHaveBeenCalledWith("claude_status", { panelId: "code" });
  });

  it("renders with custom panelId='discuss'", () => {
    renderWithMantine(<ChatPanel panelId="discuss" mode="discuss" cwd="D:\\test" />);
    expect(mockedInvoke).toHaveBeenCalledWith("claude_status", { panelId: "discuss" });
  });

  it("filters events by panelId", async () => {
    let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;

    mockedListen.mockImplementation((_eventName, handler) => {
      capturedCallback = handler as (event: { payload: PanelEvent }) => void;
      return Promise.resolve(() => {});
    });

    renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);

    await vi.waitFor(() => {
      expect(capturedCallback).not.toBeNull();
    });

    // Event for different panel — should be ignored
    capturedCallback!({
      payload: {
        panel_id: "discuss",
        event: {
          Claude: {
            type: "system",
            subtype: "init",
            session_id: "test-session",
            tools: [],
            mcp_servers: [],
            model: "opus",
          },
        },
      },
    });

    expect(screen.queryByText(/Model: opus/)).toBeNull();

    // Event for matching panel — should be processed
    capturedCallback!({
      payload: {
        panel_id: "code",
        event: {
          Claude: {
            type: "system",
            subtype: "init",
            session_id: "test-session-2",
            tools: [],
            mcp_servers: [],
            model: "sonnet",
          },
        },
      },
    });

    await vi.waitFor(() => {
      expect(screen.getByText(/Model: sonnet/)).toBeInTheDocument();
    });
  });
});
