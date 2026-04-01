import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import * as UniUi from "@uni-fw/ui";
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
    renderMsg({ id: "user-1", kind: "user", text: "Hello world" });
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders assistant-text message with markdown content", () => {
    renderMsg({ id: "assistant-1", kind: "assistant-text", text: "Response here", streaming: false });
    expect(screen.getByText("Response here")).toBeInTheDocument();
  });

  it("shows streaming cursor when assistant is streaming", () => {
    renderMsg({ id: "assistant-2", kind: "assistant-text", text: "Streaming", streaming: true });
    expect(screen.getByText("|")).toBeInTheDocument();
  });

  it("does not show cursor when not streaming", () => {
    renderMsg({ id: "assistant-3", kind: "assistant-text", text: "Done", streaming: false });
    expect(screen.queryByText("|")).not.toBeInTheDocument();
  });

  it("renders error message", () => {
    renderMsg({ id: "error-1", kind: "error", text: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders system-info message", () => {
    renderMsg({ id: "system-1", kind: "system-info", text: "Session started" });
    expect(screen.getByText("Session started")).toBeInTheDocument();
  });

  it("renders tool-use block with tool name", () => {
    renderMsg({
      id: "tool-1",
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
      id: "tool-2",
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
    renderMsg({ id: "assistant-4", kind: "assistant-text", text: "Done", streaming: false }, onSave);
    expect(screen.getByRole("button", { name: "history.save" })).toBeInTheDocument();
  });

  it("does not show bookmark button when streaming", () => {
    const onSave = vi.fn();
    renderMsg({ id: "assistant-5", kind: "assistant-text", text: "Still going", streaming: true }, onSave);
    expect(screen.queryByRole("button", { name: "history.save" })).not.toBeInTheDocument();
  });

  it("does not show bookmark button without onSave", () => {
    renderMsg({ id: "assistant-6", kind: "assistant-text", text: "Done", streaming: false });
    expect(screen.queryByRole("button", { name: "history.save" })).not.toBeInTheDocument();
  });

  it("renders tool-use with success result badge", () => {
    renderMsg({
      id: "tool-3",
      kind: "tool-use",
      toolName: "Grep",
      toolId: "tool-3",
      inputJson: JSON.stringify({ pattern: "foo" }),
      result: { isError: false, content: "match found" },
    });
    expect(screen.getByText("chat.toolResult")).toBeInTheDocument();
  });

  it("memo prevents rerender for identical props", () => {
    const markdownSpy = vi.spyOn(UniUi, "MarkdownRenderer");
    const message: ChatMessage = {
      id: "assistant-memo",
      kind: "assistant-text",
      text: "Stable content",
      streaming: false,
    };

    const { rerender } = render(
      <MantineProvider>
        <MessageItem message={message} />
      </MantineProvider>,
    );

    expect(markdownSpy).toHaveBeenCalledTimes(1);

    rerender(
      <MantineProvider>
        <MessageItem message={message} />
      </MantineProvider>,
    );

    expect(markdownSpy).toHaveBeenCalledTimes(1);
  });
});
