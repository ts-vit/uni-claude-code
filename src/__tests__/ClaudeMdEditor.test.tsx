import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { ClaudeMdEditor } from "../components/ClaudeMdEditor";
import type { ClaudeMdInfo } from "../types/claude";

const mockedInvoke = vi.mocked(invoke);

const mockExisting: ClaudeMdInfo = {
  exists: true,
  content: "# My Project\n\n## Overview\n\nSome description\n\n## Commands\n\nBuild stuff",
  toc: [
    { level: 1, text: "My Project", indent: 0 },
    { level: 2, text: "Overview", indent: 1 },
    { level: 2, text: "Commands", indent: 1 },
  ],
  path: "/test/project/CLAUDE.md",
};

const mockNotFound: ClaudeMdInfo = {
  exists: false,
  content: "",
  toc: [],
  path: "/test/project/CLAUDE.md",
};

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("ClaudeMdEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title", async () => {
    mockedInvoke.mockResolvedValue(mockExisting);
    renderWithMantine(<ClaudeMdEditor cwd="/test/project" />);
    expect(screen.getByText("claudeMd.title")).toBeInTheDocument();
  });

  it("shows create button when CLAUDE.md not found", async () => {
    mockedInvoke.mockResolvedValue(mockNotFound);
    renderWithMantine(<ClaudeMdEditor cwd="/test/project" />);
    await waitFor(() => {
      expect(screen.getByText("claudeMd.notFound")).toBeInTheDocument();
      expect(screen.getByText("claudeMd.create")).toBeInTheDocument();
    });
  });

  it("shows markdown content in preview mode", async () => {
    mockedInvoke.mockResolvedValue(mockExisting);
    renderWithMantine(<ClaudeMdEditor cwd="/test/project" />);
    await waitFor(() => {
      // MarkdownRenderer is mocked to return content as text node
      expect(screen.getByText(/Some description/)).toBeInTheDocument();
      expect(screen.getByText(/Build stuff/)).toBeInTheDocument();
    });
  });

  it("shows TOC sidebar with headings", async () => {
    mockedInvoke.mockResolvedValue(mockExisting);
    renderWithMantine(<ClaudeMdEditor cwd="/test/project" />);
    await waitFor(() => {
      expect(screen.getByText("claudeMd.tableOfContents")).toBeInTheDocument();
      expect(screen.getByText("My Project")).toBeInTheDocument();
      expect(screen.getByText("Overview")).toBeInTheDocument();
      expect(screen.getByText("Commands")).toBeInTheDocument();
    });
  });

  it("switches to edit mode and shows textarea", async () => {
    mockedInvoke.mockResolvedValue(mockExisting);
    renderWithMantine(<ClaudeMdEditor cwd="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText(/Some description/)).toBeInTheDocument();
    });

    // Find edit button — it's inside an ActionIcon, look for all buttons and find the edit one
    const buttons = screen.getAllByRole("button");
    // The edit button is the first ActionIcon in the toolbar (after the title)
    const editButton = buttons.find(
      (btn) => btn.querySelector("svg") && !btn.textContent,
    );
    expect(editButton).toBeDefined();
    fireEvent.click(editButton!);

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue(mockExisting.content);
    });
  });

  it("scrolls to heading when TOC item is clicked", async () => {
    mockedInvoke.mockResolvedValue(mockExisting);
    renderWithMantine(<ClaudeMdEditor cwd="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });

    const mockScrollIntoView = vi.fn();
    const mockElement = document.createElement("div");
    mockElement.scrollIntoView = mockScrollIntoView;
    vi.spyOn(document, "getElementById").mockReturnValue(mockElement);

    fireEvent.click(screen.getByText("Overview"));

    expect(document.getElementById).toHaveBeenCalledWith("overview");
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    vi.restoreAllMocks();
  });

  it("invokes claude_md_read on mount", async () => {
    mockedInvoke.mockResolvedValue(mockExisting);
    renderWithMantine(<ClaudeMdEditor cwd="/test/project" />);
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("claude_md_read", {
        cwd: "/test/project",
      });
    });
  });
});
