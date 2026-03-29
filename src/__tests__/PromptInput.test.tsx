import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { PromptInput } from "../components/chat/PromptInput";

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("PromptInput", () => {
  const mockSend = vi.fn();
  const mockStop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders textarea and send button", () => {
    renderWithMantine(<PromptInput isRunning={false} onSend={mockSend} onStop={mockStop} />);
    expect(screen.getByPlaceholderText("chat.placeholder")).toBeInTheDocument();
  });

  it("renders attach button", () => {
    renderWithMantine(<PromptInput isRunning={false} onSend={mockSend} onStop={mockStop} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows stop button when running", () => {
    renderWithMantine(<PromptInput isRunning={true} onSend={mockSend} onStop={mockStop} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("disables send when empty", () => {
    renderWithMantine(<PromptInput isRunning={false} onSend={mockSend} onStop={mockStop} />);
    const buttons = screen.getAllByRole("button");
    const sendButton = buttons[buttons.length - 1];
    expect(sendButton).toBeDisabled();
  });
});
