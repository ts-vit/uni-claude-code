import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { ToolUseBlock } from "../components/chat/ToolUseBlock";

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("ToolUseBlock", () => {
  it("renders tool name", () => {
    renderWithMantine(
      <ToolUseBlock toolName="Bash" inputJson='{"command":"ls -la"}' />
    );
    expect(screen.getByText("Bash")).toBeInTheDocument();
  });

  it("shows summary for Bash tool", () => {
    renderWithMantine(
      <ToolUseBlock toolName="Bash" inputJson='{"command":"ls -la"}' />
    );
    expect(screen.getByText("ls -la")).toBeInTheDocument();
  });

  it("shows summary for WebSearch tool", () => {
    renderWithMantine(
      <ToolUseBlock toolName="WebSearch" inputJson='{"query":"Rust 2026 news"}' />
    );
    expect(screen.getByText("WebSearch")).toBeInTheDocument();
    expect(screen.getByText("Rust 2026 news")).toBeInTheDocument();
  });

  it("shows summary for WebFetch tool", () => {
    renderWithMantine(
      <ToolUseBlock toolName="WebFetch" inputJson='{"url":"https://example.com"}' />
    );
    expect(screen.getByText("WebFetch")).toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  it("shows summary for ToolSearch tool", () => {
    renderWithMantine(
      <ToolUseBlock toolName="ToolSearch" inputJson='{"query":"WebSearch","max_results":1}' />
    );
    expect(screen.getByText("ToolSearch")).toBeInTheDocument();
    expect(screen.getByText("WebSearch")).toBeInTheDocument();
  });

  it("expands to show input JSON on click", () => {
    renderWithMantine(
      <ToolUseBlock toolName="WebSearch" inputJson='{"query":"test"}' />
    );
    fireEvent.click(screen.getByText("WebSearch"));
    // After expand, full JSON is visible in Code block
    expect(screen.getByText(/"query": "test"/)).toBeInTheDocument();
  });

  it("shows result badge when result is provided", () => {
    renderWithMantine(
      <ToolUseBlock
        toolName="WebSearch"
        inputJson='{"query":"test"}'
        result={{ content: "search results here", isError: false }}
      />
    );
    expect(screen.getByText("chat.toolResult")).toBeInTheDocument();
  });

  it("shows error badge when result is error", () => {
    renderWithMantine(
      <ToolUseBlock
        toolName="WebSearch"
        inputJson='{"query":"test"}'
        result={{ content: "timeout", isError: true }}
      />
    );
    expect(screen.getByText("chat.error")).toBeInTheDocument();
  });

  it("handles partial/invalid JSON gracefully", () => {
    renderWithMantine(
      <ToolUseBlock toolName="WebSearch" inputJson='{"query":"te' />
    );
    expect(screen.getByText("WebSearch")).toBeInTheDocument();
    // No crash, no summary shown for partial JSON
  });
});
