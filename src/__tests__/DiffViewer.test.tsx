import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { DiffViewer } from "../components/DiffViewer";
import type { ChangedFile, FileDiff } from "../types/claude";

const mockedInvoke = vi.mocked(invoke);

const mockChangedFiles: ChangedFile[] = [
  { path: "src/main.rs", status: "modified" },
  { path: "src/new_file.rs", status: "untracked" },
  { path: "src/old.rs", status: "deleted" },
];

const mockDiff: FileDiff = {
  path: "src/main.rs",
  hunks: [
    {
      header: "@@ -1,3 +1,4 @@",
      lines: [
        { kind: "context", content: "fn main() {", oldLine: 1, newLine: 1 },
        {
          kind: "deletion",
          content: '    println!("old");',
          oldLine: 2,
          newLine: null,
        },
        {
          kind: "addition",
          content: '    println!("new");',
          oldLine: null,
          newLine: 2,
        },
        { kind: "context", content: "}", oldLine: 3, newLine: 3 },
      ],
    },
  ],
  isBinary: false,
  additions: 1,
  deletions: 1,
};

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("DiffViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and file count", async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "git_changed_files") return mockChangedFiles;
      return null;
    });

    renderWithMantine(<DiffViewer cwd="/test/project" />);

    expect(screen.getByText("diff.title")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("3 diff.filesChanged")).toBeInTheDocument();
    });
  });

  it("shows no changed files message when empty", async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "git_changed_files") return [];
      return null;
    });

    renderWithMantine(<DiffViewer cwd="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText("diff.noChangedFiles")).toBeInTheDocument();
    });
  });

  it("renders file list with status badges", async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "git_changed_files") return mockChangedFiles;
      return null;
    });

    renderWithMantine(<DiffViewer cwd="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText("main.rs")).toBeInTheDocument();
      expect(screen.getByText("new_file.rs")).toBeInTheDocument();
      expect(screen.getByText("old.rs")).toBeInTheDocument();
    });
  });

  it("shows select file prompt when no file selected", async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "git_changed_files") return mockChangedFiles;
      return null;
    });

    renderWithMantine(<DiffViewer cwd="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText("diff.selectFile")).toBeInTheDocument();
    });
  });

  it("loads and renders diff when file is clicked", async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "git_changed_files") return mockChangedFiles;
      if (cmd === "file_diff") return mockDiff;
      return null;
    });

    renderWithMantine(<DiffViewer cwd="/test/project" />);

    await waitFor(() => {
      expect(screen.getByText("main.rs")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("main.rs"));

    await waitFor(() => {
      expect(screen.getByText("+1")).toBeInTheDocument();
      expect(screen.getByText("-1")).toBeInTheDocument();
      expect(screen.getByText("@@ -1,3 +1,4 @@")).toBeInTheDocument();
    });
  });

  it("loads diff for initialFile on mount", async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "git_changed_files") return mockChangedFiles;
      if (cmd === "file_diff") return mockDiff;
      return null;
    });

    renderWithMantine(
      <DiffViewer cwd="/test/project" initialFile="src/main.rs" />,
    );

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("file_diff", {
        cwd: "/test/project",
        filePath: "src/main.rs",
      });
    });
  });
});
