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
  DualPanelLayout: ({ projectId }: { projectId: string }) => (
    <div>{`dual-panel-${projectId}`}</div>
  ),
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

  it("keeps previously active project layout mounted when switching projects", async () => {
    renderWithMantine(<App />);

    fireEvent.click(screen.getByRole("button", { name: "open-project-1" }));

    await waitFor(() => {
      expect(screen.getByText("dual-panel-p1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "open-project-2" }));

    await waitFor(() => {
      expect(screen.getByText("dual-panel-p2")).toBeInTheDocument();
    });

    // PERSIST-02: both DualPanelLayouts must remain mounted in DOM after project switch.
    // The previously-active project's layout is hidden via display:none (not unmounted),
    // so its React state (ChatPanel messages, sessionResult, refs) survives the switch.
    expect(screen.getByText("dual-panel-p1")).toBeInTheDocument();
    expect(screen.getByText("dual-panel-p2")).toBeInTheDocument();
  });

  it("keeps active project layout mounted when switching views", async () => {
    renderWithMantine(<App />);

    fireEvent.click(screen.getByRole("button", { name: "open-project-1" }));

    await waitFor(() => {
      expect(screen.getByText("dual-panel-p1")).toBeInTheDocument();
    });

    // Selector fallback: Mantine ActionIcon inside <Tooltip label={t("common.settings")}>
    // does not propagate the tooltip label as an aria-label, so getByRole("button",
    // { name: "common.settings" }) does not match. Use the IconSettings class selector
    // (pattern already used in DualPanelLayout.test.tsx for icon-only buttons).
    const settingsBtn = document
      .querySelector(".tabler-icon-settings")
      ?.closest("button");
    expect(settingsBtn).not.toBeNull();
    fireEvent.click(settingsBtn!);

    // After view switches to "settings", the SettingsPage mock renders "settings".
    await waitFor(() => {
      expect(screen.getByText("settings")).toBeInTheDocument();
    });

    // PERSIST-01: DualPanelLayout of the active project must remain mounted in DOM
    // when view !== "main" (hidden via display:none on the parent wrapper).
    expect(screen.getByText("dual-panel-p1")).toBeInTheDocument();

    // Switch view back to "main" by clicking the same settings ActionIcon (it toggles).
    fireEvent.click(settingsBtn!);

    // After return to main, dual-panel-p1 is still mounted.
    // SettingsPage mock may also still be in DOM (sibling overlay block uses display:none
    // for view !== "main", but our mock is conditionally rendered inside that overlay via
    // a view === "settings" ternary, so it unmounts). We only assert on dual-panel-p1.
    await waitFor(() => {
      expect(screen.getByText("dual-panel-p1")).toBeInTheDocument();
    });
  });
});
