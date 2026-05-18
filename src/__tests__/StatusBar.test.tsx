import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { StatusBar } from "../components/chat/StatusBar";
import type { SessionResult, Usage } from "../types/claude";

function renderBar(opts: {
  isRunning?: boolean;
  sessionResult?: SessionResult | null;
  model?: string | null;
  sessionId?: string | null;
  usage?: Usage | null;
} = {}) {
  return render(
    <MantineProvider>
      <StatusBar
        isRunning={opts.isRunning ?? false}
        sessionResult={opts.sessionResult ?? null}
        model={opts.model ?? null}
        sessionId={opts.sessionId ?? null}
        usage={opts.usage ?? null}
      />
    </MantineProvider>,
  );
}

describe("StatusBar", () => {
  it("shows running status when isRunning is true", () => {
    renderBar({ isRunning: true });
    expect(screen.getByText("chat.running")).toBeInTheDocument();
  });

  it("shows idle status when isRunning is false", () => {
    renderBar({ isRunning: false });
    expect(screen.getByText("chat.idle")).toBeInTheDocument();
  });

  it("shows cost when sessionResult has cost > 0", () => {
    renderBar({ sessionResult: { cost: 0.1234, permissionDenials: [] } });
    expect(screen.getByText(/chat\.cost/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.1234/)).toBeInTheDocument();
  });

  it("hides cost when cost is 0", () => {
    renderBar({ sessionResult: { cost: 0, permissionDenials: [] } });
    expect(screen.queryByText(/chat\.cost/)).not.toBeInTheDocument();
  });

  it("hides cost when cost is undefined", () => {
    renderBar({ sessionResult: { permissionDenials: [] } });
    expect(screen.queryByText(/chat\.cost/)).not.toBeInTheDocument();
  });

  it("shows duration when present", () => {
    renderBar({ sessionResult: { durationMs: 5000, permissionDenials: [] } });
    expect(screen.getByText(/chat\.duration/)).toBeInTheDocument();
    expect(screen.getByText(/5\.0s/)).toBeInTheDocument();
  });

  it("shows turns count when present", () => {
    renderBar({ sessionResult: { numTurns: 3, permissionDenials: [] } });
    expect(screen.getByText(/chat\.turns/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("does not show session details when sessionResult is null", () => {
    renderBar();
    expect(screen.queryByText(/chat\.cost/)).not.toBeInTheDocument();
    expect(screen.queryByText(/chat\.duration/)).not.toBeInTheDocument();
    expect(screen.queryByText(/chat\.turns/)).not.toBeInTheDocument();
  });

  // --- New tests for model/session/tokens fields ---

  it("shows model when model prop is set", () => {
    renderBar({ model: "claude-sonnet-4-6" });
    expect(screen.getByText(/claude-sonnet-4-6/)).toBeInTheDocument();
    expect(screen.getByText(/chat\.model/)).toBeInTheDocument();
  });

  it("shows em-dash for model when null", () => {
    renderBar({ model: null });
    expect(screen.getByText((content) => /chat\.model.*—/.test(content))).toBeInTheDocument();
  });

  it("shows session_id prefix when sessionId set", () => {
    renderBar({ sessionId: "abc12345-def6-7890-abcd-ef1234567890" });
    expect(screen.getByText(/abc12345\.\.\./)).toBeInTheDocument();
    expect(screen.queryByText(/def6-7890-abcd-ef1234567890/)).not.toBeInTheDocument();
  });

  it("renders copy button when sessionId is set", () => {
    renderBar({ sessionId: "test-uuid-12345678" });
    expect(screen.getByRole("button", { name: "chat.copySessionId" })).toBeInTheDocument();
  });

  it("does not render copy button when sessionId is null", () => {
    renderBar({ sessionId: null });
    expect(screen.queryByRole("button", { name: "chat.copySessionId" })).not.toBeInTheDocument();
  });

  it("shows sum of usage tokens when usage is set", () => {
    const usage: Usage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 200,
    };
    renderBar({ usage });
    expect(screen.getByText(/chat\.tokens/)).toBeInTheDocument();
    expect(screen.getByText(/350/)).toBeInTheDocument();
  });

  it("shows em-dash for tokens when usage is null", () => {
    renderBar({ usage: null });
    expect(screen.getByText((content) => /chat\.tokens.*—/.test(content))).toBeInTheDocument();
  });
});
