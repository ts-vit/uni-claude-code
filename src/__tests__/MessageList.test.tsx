import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MessageList } from "../components/chat/MessageList";
import type { ChatMessage } from "../types/claude";

const scrollToIndex = vi.fn();

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: Math.min(count, 8) }, (_, index) => ({ index, start: index * 80 })),
    getTotalSize: () => count * 80,
    measureElement: vi.fn(),
    scrollToIndex,
  }),
}));

function createMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `assistant-${index}`,
    kind: "assistant-text" as const,
    text: `Message ${index}`,
    streaming: false,
  }));
}

function renderList(messages: ChatMessage[]) {
  return render(
    <MantineProvider>
      <div style={{ height: 600 }}>
        <MessageList messages={messages} />
      </div>
    </MantineProvider>,
  );
}

describe("MessageList", () => {
  beforeEach(() => {
    scrollToIndex.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      value: 4000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 600,
    });
  });

  it("renders with virtualizer container", async () => {
    const { container } = renderList(createMessages(10));

    await vi.waitFor(() => {
      expect(container.querySelector("[data-index]")).toBeInTheDocument();
    });
  });

  it("renders visible messages only", async () => {
    const { container } = renderList(createMessages(100));

    await vi.waitFor(() => {
      const renderedItems = container.querySelectorAll("[data-index]");
      expect(renderedItems.length).toBeGreaterThan(0);
      expect(renderedItems.length).toBeLessThan(100);
    });
  });

  it("autoscrolls on new message", async () => {
    const messages = createMessages(20);
    const { rerender } = render(
      <MantineProvider>
        <div style={{ height: 600 }}>
          <MessageList messages={messages} />
        </div>
      </MantineProvider>,
    );

    rerender(
      <MantineProvider>
        <div style={{ height: 600 }}>
          <MessageList messages={createMessages(120)} />
        </div>
      </MantineProvider>,
    );

    await vi.waitFor(() => {
      expect(scrollToIndex).toHaveBeenCalledWith(119, { align: "end" });
    });
  });

  it("shows load earlier button at top scroll", async () => {
    const onLoadEarlier = vi.fn();
    const { container } = render(
      <MantineProvider>
        <div style={{ height: 600 }}>
          <MessageList
            messages={createMessages(40)}
            hasEarlierMessages
            onLoadEarlier={onLoadEarlier}
          />
        </div>
      </MantineProvider>,
    );

    const scrollContainer = container.querySelector("div[style*='overflow-y: auto']") as HTMLDivElement | null;
    expect(scrollContainer).not.toBeNull();

    if (!scrollContainer) {
      return;
    }

    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    fireEvent.scroll(scrollContainer);

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "chat.loadEarlierMessages" })).toBeInTheDocument();
    });
  });
});
