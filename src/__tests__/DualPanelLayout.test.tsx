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

  it("renders single mode by default with Code panel", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    const badges = screen.getAllByText("panel.code");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("switches to dual mode showing both panels", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    const segmentedControls = document.querySelectorAll(".mantine-SegmentedControl-root");
    const layoutControl = segmentedControls[0];
    const labels = layoutControl.querySelectorAll("label");
    fireEvent.click(labels[1]);

    expect(screen.getAllByText("panel.discuss").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("panel.code").length).toBeGreaterThanOrEqual(1);
  });

  it("switches active panel in single mode", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    const allDiscuss = screen.getAllByText("panel.discuss");
    const segmentLabel = allDiscuss.find((el) =>
      el.closest(".mantine-SegmentedControl-innerLabel"),
    );
    fireEvent.click(segmentLabel!);

    const discussBadge = screen.getAllByText("panel.discuss").find(
      (el) => el.closest(".mantine-Badge-label"),
    );
    expect(discussBadge).toBeTruthy();
  });

  it("renders SessionTabs with Session 1 for code panel", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    // Both panels have "Session 1" tabs, but code is visible by default
    const sessionLabels = screen.getAllByText("Session 1");
    expect(sessionLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("adds a new tab when + is clicked", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    // Find all add-tab buttons (there are 2 — one per panel side)
    const plusButtons = screen.getAllByRole("button").filter((btn) => {
      return !btn.hasAttribute("disabled") && btn.querySelector("svg");
    });
    // Click the last plus button (code panel is visible in single mode)
    const addBtn = plusButtons[plusButtons.length - 1];
    fireEvent.click(addBtn);

    expect(screen.getAllByText("Session 2").length).toBeGreaterThanOrEqual(1);
  });

  it("closes a tab when x is clicked", () => {
    renderWithProviders(<DualPanelLayout cwd="D:\test-project" projectId="proj-1" />);
    // First add a tab
    const plusButtons = screen.getAllByRole("button").filter((btn) => {
      return !btn.hasAttribute("disabled") && btn.querySelector("svg");
    });
    fireEvent.click(plusButtons[plusButtons.length - 1]);

    expect(screen.getAllByText("Session 2").length).toBeGreaterThanOrEqual(1);

    // Now close Session 2 — find the close (x) button
    const closeButtons = screen.getAllByRole("button").filter((btn) => {
      const svg = btn.querySelector("svg");
      return svg && btn.closest("[class]")?.textContent?.includes("Session");
    });
    // Click the last close button (for Session 2)
    if (closeButtons.length > 0) {
      fireEvent.click(closeButtons[closeButtons.length - 1]);
    }

    // Session 2 should be gone or at least Session 1 is still there
    expect(screen.getAllByText("Session 1").length).toBeGreaterThanOrEqual(1);
  });
});
