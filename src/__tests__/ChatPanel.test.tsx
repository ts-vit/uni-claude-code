import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ChatPanel } from "../components/chat/ChatPanel";
import type { PanelEvent } from "../types/claude";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 80 })),
    getTotalSize: () => count * 80,
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}));

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
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(16);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
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

  it("limits messages in memory", async () => {
    let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;

    mockedListen.mockImplementation((_eventName, handler) => {
      capturedCallback = handler as (event: { payload: PanelEvent }) => void;
      return Promise.resolve(() => {});
    });

    renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);

    await vi.waitFor(() => {
      expect(capturedCallback).not.toBeNull();
    });

    for (let i = 0; i < 205; i++) {
      capturedCallback!({
        payload: {
          panel_id: "code",
          event: {
            Claude: {
              type: "result",
              subtype: "success",
              duration_ms: 1,
              is_error: false,
              num_turns: 1,
              result: `Result ${i}`,
              session_id: `session-${i}`,
              total_cost_usd: 0,
              usage: null,
              permission_denials: [],
            },
          },
        },
      });
    }

    await vi.waitFor(() => {
      expect(screen.getByText("Result 204")).toBeInTheDocument();
    });

    expect(screen.queryByText("Result 0")).not.toBeInTheDocument();
  });

  it("cleans streaming buffer after done", async () => {
    let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;

    mockedListen.mockImplementation((_eventName, handler) => {
      capturedCallback = handler as (event: { payload: PanelEvent }) => void;
      return Promise.resolve(() => {});
    });

    renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);

    await vi.waitFor(() => {
      expect(capturedCallback).not.toBeNull();
    });

    act(() => {
      capturedCallback!({
        payload: {
          panel_id: "code",
          event: {
            Claude: {
              type: "stream_event",
              session_id: "stream-session",
              event: {
                type: "content_block_delta",
                index: 0,
                delta: {
                  type: "text_delta",
                  text: "Hello ",
                },
              },
            },
          },
        },
      });

      capturedCallback!({
        payload: {
          panel_id: "code",
          event: {
            Claude: {
              type: "stream_event",
              session_id: "stream-session",
              event: {
                type: "content_block_delta",
                index: 0,
                delta: {
                  type: "text_delta",
                  text: "world",
                },
              },
            },
          },
        },
      });

      capturedCallback!({
        payload: {
          panel_id: "code",
          event: {
            Claude: {
              type: "stream_event",
              session_id: "stream-session",
              event: {
                type: "message_stop",
              },
            },
          },
        },
      });

      capturedCallback!({
        payload: {
          panel_id: "code",
          event: {
            Claude: {
              type: "stream_event",
              session_id: "stream-session-2",
              event: {
                type: "content_block_delta",
                index: 0,
                delta: {
                  type: "text_delta",
                  text: "Next",
                },
              },
            },
          },
        },
      });
    });

    await vi.waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    expect(screen.queryByText("Hello worldNext")).not.toBeInTheDocument();
  });

  it("removes listener on unmount", async () => {
    const unlisten = vi.fn();
    mockedListen.mockResolvedValue(unlisten);

    const { unmount } = renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);

    await vi.waitFor(() => {
      expect(mockedListen).toHaveBeenCalledWith("claude-event", expect.any(Function));
    });

    unmount();

    await vi.waitFor(() => {
      expect(unlisten).toHaveBeenCalledTimes(1);
    });
  });

  it("accumulates usage tokens from assistant events", async () => {
    let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;
    mockedListen.mockImplementation((_eventName, handler) => {
      capturedCallback = handler as (event: { payload: PanelEvent }) => void;
      return Promise.resolve(() => {});
    });

    renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);
    await vi.waitFor(() => expect(capturedCallback).not.toBeNull());

    // First assistant event — init accumulator
    act(() => {
      capturedCallback!({
        payload: {
          panel_id: "code",
          event: {
            Claude: {
              type: "assistant",
              session_id: "s1",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "Hi" }],
                usage: {
                  input_tokens: 100,
                  output_tokens: 50,
                  cache_creation_input_tokens: 0,
                  cache_read_input_tokens: 200,
                },
              },
            },
          },
        },
      });
    });

    // Second assistant event — accumulate
    act(() => {
      capturedCallback!({
        payload: {
          panel_id: "code",
          event: {
            Claude: {
              type: "assistant",
              session_id: "s1",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "More" }],
                usage: {
                  input_tokens: 200,
                  output_tokens: 100,
                  cache_creation_input_tokens: 0,
                  cache_read_input_tokens: 100,
                },
              },
            },
          },
        },
      });
    });

    // Expected sum: 300 + 150 + 0 + 300 = 750
    await vi.waitFor(() => {
      expect(screen.getByText((content) => /chat\.tokens/.test(content) && /750/.test(content))).toBeInTheDocument();
    });
  });

  it("resets accumulator when session_id changes via system event", async () => {
    let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;
    mockedListen.mockImplementation((_eventName, handler) => {
      capturedCallback = handler as (event: { payload: PanelEvent }) => void;
      return Promise.resolve(() => {});
    });

    renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);
    await vi.waitFor(() => expect(capturedCallback).not.toBeNull());

    // System event with session_id=s1
    act(() => {
      capturedCallback!({
        payload: { panel_id: "code", event: { Claude: { type: "system", subtype: "init", session_id: "s1", tools: [], mcp_servers: [], model: "sonnet" } } },
      });
    });

    // Assistant event — accumulator -> 100
    act(() => {
      capturedCallback!({
        payload: { panel_id: "code", event: { Claude: { type: "assistant", session_id: "s1", message: { role: "assistant", content: [{ type: "text", text: "" }], usage: { input_tokens: 100, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } } } },
      });
    });

    await vi.waitFor(() => {
      expect(screen.getByText((c) => /chat\.tokens/.test(c) && /100/.test(c))).toBeInTheDocument();
    });

    // New system event with different session_id=s2 — accumulator должен сброситься
    act(() => {
      capturedCallback!({
        payload: { panel_id: "code", event: { Claude: { type: "system", subtype: "init", session_id: "s2", tools: [], mcp_servers: [], model: "opus" } } },
      });
    });

    // Now accumulator is null → em-dash
    await vi.waitFor(() => {
      expect(screen.getByText((c) => /chat\.tokens/.test(c) && /—/.test(c))).toBeInTheDocument();
    });
  });

  it("disables Clear button while isRunning", async () => {
    mockedInvoke.mockResolvedValueOnce("running");
    renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);
    await vi.waitFor(() => {
      const btn = screen.getByRole("button", { name: "chat.clearChat" });
      expect(btn).toBeDisabled();
    });
  });

  it("clicking Clear resets messages, model, sessionId and accumulator", async () => {
    let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;
    mockedListen.mockImplementation((_eventName, handler) => {
      capturedCallback = handler as (event: { payload: PanelEvent }) => void;
      return Promise.resolve(() => {});
    });
    mockedInvoke.mockResolvedValue("idle");

    renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);
    await vi.waitFor(() => expect(capturedCallback).not.toBeNull());

    // Set up state: system event + assistant event with usage
    act(() => {
      capturedCallback!({ payload: { panel_id: "code", event: { Claude: { type: "system", subtype: "init", session_id: "s1", tools: [], mcp_servers: [], model: "sonnet" } } } });
      capturedCallback!({ payload: { panel_id: "code", event: { Claude: { type: "assistant", session_id: "s1", message: { role: "assistant", content: [{ type: "text", text: "Hi" }], usage: { input_tokens: 42, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } } } } });
    });

    await vi.waitFor(() => {
      expect(screen.getByText((c) => /chat\.model/.test(c) && /sonnet/.test(c))).toBeInTheDocument();
      expect(screen.getByText((c) => /chat\.tokens/.test(c) && /42/.test(c))).toBeInTheDocument();
    });

    // Click Clear
    const clearBtn = screen.getByRole("button", { name: "chat.clearChat" });
    expect(clearBtn).not.toBeDisabled();
    act(() => { clearBtn.click(); });

    // Verify state reset: model em-dash, tokens em-dash, session em-dash
    await vi.waitFor(() => {
      expect(screen.getByText((c) => /chat\.model/.test(c) && /—/.test(c))).toBeInTheDocument();
      expect(screen.getByText((c) => /chat\.tokens/.test(c) && /—/.test(c))).toBeInTheDocument();
      expect(screen.getByText((c) => /chat\.session/.test(c) && /—/.test(c))).toBeInTheDocument();
    });
  });

  it("populates sessionModel and sessionId from system event", async () => {
    let capturedCallback: ((event: { payload: PanelEvent }) => void) | null = null;
    mockedListen.mockImplementation((_eventName, handler) => {
      capturedCallback = handler as (event: { payload: PanelEvent }) => void;
      return Promise.resolve(() => {});
    });

    renderWithMantine(<ChatPanel panelId="code" cwd="D:\\test" />);
    await vi.waitFor(() => expect(capturedCallback).not.toBeNull());

    act(() => {
      capturedCallback!({
        payload: { panel_id: "code", event: { Claude: { type: "system", subtype: "init", session_id: "abc12345-uuid-rest", tools: [], mcp_servers: [], model: "claude-sonnet-4-6" } } },
      });
    });

    await vi.waitFor(() => {
      expect(screen.getByText((c) => /chat\.model/.test(c) && /claude-sonnet-4-6/.test(c))).toBeInTheDocument();
      expect(screen.getByText((c) => /chat\.session/.test(c) && /abc12345/.test(c))).toBeInTheDocument();
    });
  });
});
