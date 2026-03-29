import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { HistoryPage } from "../components/HistoryPage";
import type { SavedMessage } from "../types/claude";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

function renderPage(projectId = "proj-1") {
  return render(
    <MantineProvider>
      <HistoryPage projectId={projectId} />
    </MantineProvider>,
  );
}

describe("HistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no messages", async () => {
    mockInvoke.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("history.noMessages")).toBeInTheDocument();
  });

  it("renders saved messages", async () => {
    const msgs: SavedMessage[] = [
      {
        id: "m1",
        projectId: "proj-1",
        userPrompt: "How to use React?",
        assistantResponse: "React is a UI library.",
        model: "opus",
        sessionTabId: null,
        createdAt: 1700000000,
      },
    ];
    mockInvoke.mockResolvedValue(msgs);
    renderPage();
    expect(await screen.findByText("How to use React?")).toBeInTheDocument();
    expect(screen.getByText("React is a UI library.")).toBeInTheDocument();
  });

  it("renders title", async () => {
    mockInvoke.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("history.title")).toBeInTheDocument();
  });

  it("shows export button when messages exist", async () => {
    const msgs: SavedMessage[] = [
      {
        id: "m1",
        projectId: "proj-1",
        userPrompt: "test",
        assistantResponse: "response",
        model: null,
        sessionTabId: null,
        createdAt: 1700000000,
      },
    ];
    mockInvoke.mockResolvedValue(msgs);
    renderPage();
    expect(await screen.findByText("history.exportMarkdown")).toBeInTheDocument();
  });
});
