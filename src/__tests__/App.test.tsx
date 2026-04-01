import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@uni-fw/ui";
import { App } from "../App";

const mockedInvoke = vi.mocked(invoke);

const projects = [
  { id: "p1", name: "Project One", cwd: "/project-one", model: null, permissionMode: "default", createdAt: 1, updatedAt: 1 },
  { id: "p2", name: "Project Two", cwd: "/project-two", model: null, permissionMode: "default", createdAt: 2, updatedAt: 2 },
];

vi.mock("../components/ProjectSidebar", () => ({
  ProjectSidebar: ({ onProjectSelect }: { onProjectSelect: (project: (typeof projects)[number]) => void }) => (
    <div>
      <button type="button" onClick={() => onProjectSelect(projects[0])}>open-project-1</button>
      <button type="button" onClick={() => onProjectSelect(projects[1])}>open-project-2</button>
    </div>
  ),
}));

vi.mock("../components/DualPanelLayout", () => ({
  DualPanelLayout: ({
    projectId,
    onStateChange,
    initialState,
  }: {
    projectId: string;
    onStateChange?: (state: { projectId: string }) => void;
    initialState?: { projectId: string };
  }) => {
    onStateChange?.(initialState ?? { projectId });
    return <div>{`dual-panel-${projectId}`}</div>;
  },
}));

vi.mock("../components/SettingsPage", () => ({ SettingsPage: () => <div>settings</div> }));
vi.mock("../components/SshStatusIndicator", () => ({ SshStatusIndicator: () => <div>ssh-status</div> }));
vi.mock("../components/CreateProjectModal", () => ({
  CreateProjectModal: ({ opened }: { opened: boolean }) => (opened ? <div>create-modal</div> : null),
}));
vi.mock("../components/WelcomeScreen", () => ({
  WelcomeScreen: ({ onCreateProject }: { onCreateProject: () => void }) => (
    <button type="button" onClick={onCreateProject}>welcome-create</button>
  ),
}));
vi.mock("../components/HistoryPage", () => ({ HistoryPage: () => <div>history</div> }));
vi.mock("../components/FileTreePanel", () => ({ FileTreePanel: () => <div>files</div> }));
vi.mock("../components/ClaudeMdEditor", () => ({ ClaudeMdEditor: () => <div>claude-md</div> }));
vi.mock("../components/DiffViewer", () => ({ DiffViewer: () => <div>diff</div> }));
vi.mock("../components/PipelinePage", () => ({ PipelinePage: () => <div>pipeline</div> }));

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSettings).mockReturnValue({
      value: "3",
      loading: false,
      set: vi.fn(),
      delete: vi.fn(),
      refresh: vi.fn(),
    });
    mockedInvoke.mockResolvedValue(null);
  });

  it("does not render inactive project layout", async () => {
    renderWithMantine(<App />);

    fireEvent.click(screen.getByRole("button", { name: "open-project-1" }));

    await waitFor(() => {
      expect(screen.getByText("dual-panel-p1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "open-project-2" }));

    await waitFor(() => {
      expect(screen.getByText("dual-panel-p2")).toBeInTheDocument();
    });

    expect(screen.queryByText("dual-panel-p1")).not.toBeInTheDocument();
  });
});
