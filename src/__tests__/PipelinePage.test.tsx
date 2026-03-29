import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { PipelinePage } from "../components/PipelinePage";

const mockedInvoke = vi.mocked(invoke);

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("PipelinePage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders title", async () => {
    mockedInvoke.mockResolvedValue([]);
    renderWithMantine(<PipelinePage projectId="test-project" cwd="/test" />);
    expect(screen.getByText("pipeline.title")).toBeInTheDocument();
  });

  it("shows empty state when no tasks", async () => {
    mockedInvoke.mockResolvedValue([]);
    renderWithMantine(<PipelinePage projectId="test-project" cwd="/test" />);
    await waitFor(() => {
      expect(screen.getByText("pipeline.noTasks")).toBeInTheDocument();
    });
  });

  it("renders task list", async () => {
    mockedInvoke.mockResolvedValue([
      { id: "1", projectId: "p1", title: "Task One", description: "desc", prompt: null, status: "draft", sortOrder: 0, resultSummary: null, errorMessage: null, startedAt: null, completedAt: null, createdAt: 1000, updatedAt: 1000 },
      { id: "2", projectId: "p1", title: "Task Two", description: "", prompt: null, status: "queued", sortOrder: 1, resultSummary: null, errorMessage: null, startedAt: null, completedAt: null, createdAt: 1001, updatedAt: 1001 },
    ]);
    renderWithMantine(<PipelinePage projectId="p1" cwd="/test" />);
    await waitFor(() => {
      expect(screen.getByText("Task One")).toBeInTheDocument();
      expect(screen.getByText("Task Two")).toBeInTheDocument();
    });
  });

  it("shows queue all button when drafts exist", async () => {
    mockedInvoke.mockResolvedValue([
      { id: "1", projectId: "p1", title: "Draft Task", description: "", prompt: null, status: "draft", sortOrder: 0, resultSummary: null, errorMessage: null, startedAt: null, completedAt: null, createdAt: 1000, updatedAt: 1000 },
    ]);
    renderWithMantine(<PipelinePage projectId="p1" cwd="/test" />);
    await waitFor(() => {
      expect(screen.getByText("pipeline.queueAll")).toBeInTheDocument();
    });
  });

  it("invokes pipeline_task_list on mount", async () => {
    mockedInvoke.mockResolvedValue([]);
    renderWithMantine(<PipelinePage projectId="test-proj" cwd="/test" />);
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("pipeline_task_list", { projectId: "test-proj" });
    });
  });
});
