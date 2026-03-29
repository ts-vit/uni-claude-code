import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { StatusBar } from "../components/chat/StatusBar";
import type { SessionResult } from "../types/claude";

function renderBar(isRunning: boolean, sessionResult: SessionResult | null = null) {
  return render(
    <MantineProvider>
      <StatusBar isRunning={isRunning} sessionResult={sessionResult} />
    </MantineProvider>,
  );
}

describe("StatusBar", () => {
  it("shows running status when isRunning is true", () => {
    renderBar(true);
    expect(screen.getByText("chat.running")).toBeInTheDocument();
  });

  it("shows idle status when isRunning is false", () => {
    renderBar(false);
    expect(screen.getByText("chat.idle")).toBeInTheDocument();
  });

  it("shows cost when sessionResult has cost > 0", () => {
    renderBar(false, { cost: 0.1234, permissionDenials: [] });
    expect(screen.getByText(/chat\.cost/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.1234/)).toBeInTheDocument();
  });

  it("hides cost when cost is 0", () => {
    renderBar(false, { cost: 0, permissionDenials: [] });
    expect(screen.queryByText(/chat\.cost/)).not.toBeInTheDocument();
  });

  it("hides cost when cost is undefined", () => {
    renderBar(false, { permissionDenials: [] });
    expect(screen.queryByText(/chat\.cost/)).not.toBeInTheDocument();
  });

  it("shows duration when present", () => {
    renderBar(false, { durationMs: 5000, permissionDenials: [] });
    expect(screen.getByText(/chat\.duration/)).toBeInTheDocument();
    expect(screen.getByText(/5\.0s/)).toBeInTheDocument();
  });

  it("shows turns count when present", () => {
    renderBar(false, { numTurns: 3, permissionDenials: [] });
    expect(screen.getByText(/chat\.turns/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("does not show session details when sessionResult is null", () => {
    renderBar(false, null);
    expect(screen.queryByText(/chat\.cost/)).not.toBeInTheDocument();
    expect(screen.queryByText(/chat\.duration/)).not.toBeInTheDocument();
    expect(screen.queryByText(/chat\.turns/)).not.toBeInTheDocument();
  });
});
