import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MessageItem } from "../components/chat/MessageItem";
import type { ChatMessage } from "../types/claude";

function renderMsg(message: ChatMessage, onSave?: () => void) {
  return render(
    <MantineProvider>
      <MessageItem message={message} onSave={onSave} />
    </MantineProvider>,
  );
}

describe("MessageItem", () => {
  it("renders user message text", () => {
    renderMsg({ kind: "user", text: "Hello world" });
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders assistant-text message with markdown content", () => {
    renderMsg({ kind: "assistant-text", text: "Response here", streaming: false });
    expect(screen.getByText("Response here")).toBeInTheDocument();
  });

  it("shows streaming cursor when assistant is streaming", () => {
    renderMsg({ kind: "assistant-text", text: "Streaming", streaming: true });
    expect(screen.getByText("|")).toBeInTheDocument();
  });

  it("does not show cursor when not streaming", () => {
    renderMsg({ kind: "assistant-text", text: "Done", streaming: false });
    expect(screen.queryByText("|")).not.toBeInTheDocument();
  });

  it("renders error message", () => {
    renderMsg({ kind: "error", text: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders system-info message", () => {
    renderMsg({ kind: "system-info", text: "Session started" });
    expect(screen.getByText("Session started")).toBeInTheDocument();
  });

  it("renders tool-use block with tool name", () => {
    renderMsg({
      kind: "tool-use",
      toolName: "Read",
      toolId: "tool-1",
      inputJson: JSON.stringify({ file_path: "/tmp/test.txt" }),
    });
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("/tmp/test.txt")).toBeInTheDocument();
  });

  it("renders tool-use with error result badge", () => {
    renderMsg({
      kind: "tool-use",
      toolName: "Bash",
      toolId: "tool-2",
      inputJson: JSON.stringify({ command: "ls" }),
      result: { isError: true, content: "Permission denied" },
    });
    expect(screen.getByText("Bash")).toBeInTheDocument();
    expect(screen.getByText("chat.error")).toBeInTheDocument();
  });

  it("shows bookmark button on non-streaming assistant-text with onSave", () => {
    const onSave = vi.fn();
    renderMsg({ kind: "assistant-text", text: "Done", streaming: false }, onSave);
    expect(screen.getByRole("button", { name: "history.save" })).toBeInTheDocument();
  });

  it("does not show bookmark button when streaming", () => {
    const onSave = vi.fn();
    renderMsg({ kind: "assistant-text", text: "Still going", streaming: true }, onSave);
    expect(screen.queryByRole("button", { name: "history.save" })).not.toBeInTheDocument();
  });

  it("does not show bookmark button without onSave", () => {
    renderMsg({ kind: "assistant-text", text: "Done", streaming: false });
    expect(screen.queryByRole("button", { name: "history.save" })).not.toBeInTheDocument();
  });

  it("renders tool-use with success result badge", () => {
    renderMsg({
      kind: "tool-use",
      toolName: "Grep",
      toolId: "tool-3",
      inputJson: JSON.stringify({ pattern: "foo" }),
      result: { isError: false, content: "match found" },
    });
    expect(screen.getByText("chat.toolResult")).toBeInTheDocument();
  });
});
