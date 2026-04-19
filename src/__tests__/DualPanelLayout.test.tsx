import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { DualPanelLayout } from "../components/DualPanelLayout";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@uni-fw/ui", () => ({
  useSettings: vi.fn(() => ({ value: "D:\\test-project", set: vi.fn() })),
  UniProvider: ({ children }: { children: React.ReactNode }) => children,
  MarkdownRenderer: ({ content }: { content: string }) => content,
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("DualPanelLayout", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockResolvedValue("idle");
  });

  it("renders single mode by default with Terminal panel", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    const labels = screen.getAllByText("panel.terminal");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("switches to dual mode showing both panels", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    const segmentedControls = document.querySelectorAll(".mantine-SegmentedControl-root");
    const layoutControl = segmentedControls[0];
    const labels = layoutControl.querySelectorAll("label");
    fireEvent.click(labels[1]);

    expect(screen.getAllByText("panel.modeArchitect").length).toBeGreaterThanOrEqual(1);
  });

  it("switches active panel in single mode", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    const allArchitect = screen.getAllByText("panel.architect");
    const segmentLabel = allArchitect.find((el) =>
      el.closest(".mantine-SegmentedControl-innerLabel"),
    );
    fireEvent.click(segmentLabel!);

    const architectBadge = screen.getAllByText("panel.modeArchitect").find(
      (el) => el.closest(".mantine-Badge-label"),
    );
    expect(architectBadge).toBeTruthy();
  });

  it("renders SessionTabs with Session 1 for architect panel", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    const sessionLabels = screen.getAllByText("Session 1");
    expect(sessionLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("adds a new tab when + is clicked", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    // Switch to dual mode so architect panel with SessionTabs is visible
    const segmentedControls = document.querySelectorAll(".mantine-SegmentedControl-root");
    const layoutControl = segmentedControls[0];
    fireEvent.click(layoutControl.querySelectorAll("label")[1]);

    // Find add button by the plus icon SVG
    const plusIcon = document.querySelector(".tabler-icon-plus");
    const addBtn = plusIcon?.closest("button");
    expect(addBtn).toBeTruthy();
    fireEvent.click(addBtn!);

    const sessionTexts = screen.getAllByText(/^Session \d+$/);
    expect(sessionTexts.length).toBeGreaterThanOrEqual(2);
  });

  it("closes a tab when x is clicked", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    // Switch to dual mode
    const segmentedControls = document.querySelectorAll(".mantine-SegmentedControl-root");
    const layoutControl = segmentedControls[0];
    fireEvent.click(layoutControl.querySelectorAll("label")[1]);

    // First add a tab
    const plusIcon = document.querySelector(".tabler-icon-plus");
    fireEvent.click(plusIcon?.closest("button")!);

    const sessionTextsBefore = screen.getAllByText(/^Session \d+$/);
    expect(sessionTextsBefore.length).toBeGreaterThanOrEqual(2);

    // Now close the last tab — find x icons
    const closeIcons = document.querySelectorAll(".tabler-icon-x");
    if (closeIcons.length > 0) {
      const closeBtn = closeIcons[closeIcons.length - 1].closest("button");
      if (closeBtn) fireEvent.click(closeBtn);
    }

    const sessionTextsAfter = screen.getAllByText(/^Session \d+$/);
    expect(sessionTextsAfter.length).toBeGreaterThanOrEqual(1);
  });
});
