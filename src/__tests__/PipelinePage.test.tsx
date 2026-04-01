import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { PipelinePage } from "../components/PipelinePage";

const mockedInvoke = vi.mocked(invoke);
const mockPipelineController = vi.fn();

vi.mock("../hooks/usePipelineController", () => ({
  usePipelineController: (...args: unknown[]) => mockPipelineController(...args),
}));

vi.mock("../components/chat/ChatPanel", () => ({
  ChatPanel: ({ panelId }: { panelId: string }) => <div>{panelId}</div>,
}));

const testProjects = [
  { id: "p1", name: "Project One", cwd: "/project-one", model: null, permissionMode: "bypass", createdAt: 1000, updatedAt: 1000 },
  { id: "p2", name: "Project Two", cwd: "/project-two", model: "opus", permissionMode: "default", createdAt: 1001, updatedAt: 1001 },
];

const testTaskCounts = [
  { projectId: "p1", total: 5, done: 3 },
  { projectId: "p2", total: 2, done: 2 },
];

const testTasks = [
  { id: "1", projectId: "p1", title: "Task One", description: "desc", prompt: null, status: "draft", sortOrder: 0, resultSummary: null, errorMessage: null, startedAt: null, completedAt: null, createdAt: 1000, updatedAt: 1000 },
  { id: "2", projectId: "p1", title: "Task Two", description: "", prompt: null, status: "queued", sortOrder: 1, resultSummary: null, errorMessage: null, startedAt: null, completedAt: null, createdAt: 1001, updatedAt: 1001 },
];

function mockInvokeHandler(cmd: string, _args?: Record<string, unknown>) {
  switch (cmd) {
    case "project_list": return Promise.resolve(testProjects);
    case "pipeline_task_counts": return Promise.resolve(testTaskCounts);
    case "pipeline_task_list": return Promise.resolve(testTasks);
    default: return Promise.resolve([]);
  }
}

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("PipelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInvoke.mockImplementation(mockInvokeHandler as typeof invoke);
    mockPipelineController.mockReturnValue({
      status: "idle",
      currentTaskId: null,
      currentPhase: null,
      log: [],
      start: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      resume: vi.fn(),
      clearLog: vi.fn(),
      PIPELINE_DISCUSS_PANEL: "pipeline-discuss",
      PIPELINE_CODE_PANEL: "pipeline-code",
    });
  });

  it("shows EmptyState when no project selected", async () => {
    renderWithMantine(<PipelinePage onProjectSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("pipeline.selectProject")).toBeInTheDocument();
    });
  });

  it("shows project list in sidebar", async () => {
    renderWithMantine(<PipelinePage onProjectSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Project One")).toBeInTheDocument();
      expect(screen.getByText("Project Two")).toBeInTheDocument();
    });
  });

  it("shows task count badges", async () => {
    renderWithMantine(<PipelinePage onProjectSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("3/5")).toBeInTheDocument();
      expect(screen.getByText("2/2")).toBeInTheDocument();
    });
  });

  it("renders pipeline title when project selected", async () => {
    renderWithMantine(<PipelinePage initialProjectId="p1" onProjectSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("pipeline.title")).toBeInTheDocument();
    });
  });

  it("renders task list when project selected", async () => {
    renderWithMantine(<PipelinePage initialProjectId="p1" onProjectSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Task One")).toBeInTheDocument();
      expect(screen.getByText("Task Two")).toBeInTheDocument();
    });
  });

  it("shows queue all button when drafts exist", async () => {
    renderWithMantine(<PipelinePage initialProjectId="p1" onProjectSelect={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("pipeline.queueAll")).toBeInTheDocument();
    });
  });

  it("invokes project_list and pipeline_task_counts on mount", async () => {
    renderWithMantine(<PipelinePage onProjectSelect={vi.fn()} />);
    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("project_list");
      expect(mockedInvoke).toHaveBeenCalledWith("pipeline_task_counts");
    });
  });

  it("does not render inactive pipeline phase", async () => {
    mockPipelineController.mockReturnValue({
      status: "running",
      currentTaskId: "1",
      currentPhase: "discuss",
      log: [],
      start: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      resume: vi.fn(),
      clearLog: vi.fn(),
      PIPELINE_DISCUSS_PANEL: "pipeline-discuss",
      PIPELINE_CODE_PANEL: "pipeline-code",
    });

    renderWithMantine(<PipelinePage initialProjectId="p1" onProjectSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("pipeline-discuss")).toBeInTheDocument();
    });

    expect(screen.queryByText("pipeline-code")).not.toBeInTheDocument();
  });
});
