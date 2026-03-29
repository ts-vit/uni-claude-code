import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { FileTreePanel } from "../components/FileTreePanel";
import type { FileTreeNode } from "../types/claude";

const mockedInvoke = vi.mocked(invoke);

const mockTree: FileTreeNode[] = [
  {
    name: "src",
    path: "src",
    isDir: true,
    status: "modified",
    children: [
      {
        name: "main.ts",
        path: "src/main.ts",
        isDir: false,
        status: "modified",
        children: [],
      },
      {
        name: "utils.ts",
        path: "src/utils.ts",
        isDir: false,
        status: null,
        children: [],
      },
    ],
  },
  {
    name: "README.md",
    path: "README.md",
    isDir: false,
    status: "untracked",
    children: [],
  },
];

const mockBranch = {
  name: "main",
  headHash: "abc1234",
  isDetached: false,
};

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("FileTreePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "file_tree") return mockTree;
      if (cmd === "git_branch_info") return mockBranch;
      return null;
    });
  });

  it("renders title", async () => {
    renderWithMantine(
      <FileTreePanel cwd="/test/project" />,
    );
    expect(screen.getByText("files.title")).toBeInTheDocument();
  });

  it("shows branch badge after loading", async () => {
    renderWithMantine(
      <FileTreePanel cwd="/test/project" />,
    );
    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });
  });

  it("renders file tree nodes", async () => {
    renderWithMantine(
      <FileTreePanel cwd="/test/project" />,
    );
    await waitFor(() => {
      expect(screen.getByText("src")).toBeInTheDocument();
      expect(screen.getByText("README.md")).toBeInTheDocument();
    });
  });

  it("expands directory on click", async () => {
    renderWithMantine(
      <FileTreePanel cwd="/test/project" />,
    );
    await waitFor(() => {
      expect(screen.getByText("src")).toBeInTheDocument();
    });

    // Children should not be visible initially
    expect(screen.queryByText("main.ts")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText("src"));

    await waitFor(() => {
      expect(screen.getByText("main.ts")).toBeInTheDocument();
      expect(screen.getByText("utils.ts")).toBeInTheDocument();
    });
  });

  it("calls onFileSelect when file is clicked", async () => {
    const onFileSelect = vi.fn();
    renderWithMantine(
      <FileTreePanel cwd="/test/project" onFileSelect={onFileSelect} />,
    );
    await waitFor(() => {
      expect(screen.getByText("README.md")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("README.md"));
    expect(onFileSelect).toHaveBeenCalledWith("README.md");
  });

  it("shows git status indicators", async () => {
    renderWithMantine(
      <FileTreePanel cwd="/test/project" />,
    );
    await waitFor(() => {
      // "U" for untracked README.md, "M" for modified src directory
      expect(screen.getByText("U")).toBeInTheDocument();
      expect(screen.getByText("M")).toBeInTheDocument();
    });
  });

  it("invokes file_tree and git_branch_info on mount", async () => {
    renderWithMantine(
      <FileTreePanel cwd="/test/project" />,
    );
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("file_tree", {
        cwd: "/test/project",
        maxDepth: 4,
      });
      expect(mockedInvoke).toHaveBeenCalledWith("git_branch_info", {
        cwd: "/test/project",
      });
    });
  });
});
