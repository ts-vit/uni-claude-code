import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { ProjectSidebar } from "../components/ProjectSidebar";
import type { Project } from "../types/claude";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const mockProjects: Project[] = [
  { id: "1", name: "Project One", cwd: "D:\\projects\\one", model: null, permissionMode: "bypass", createdAt: 1700000000, updatedAt: 1700000001 },
  { id: "2", name: "Project Two", cwd: "D:\\projects\\two", model: null, permissionMode: "bypass", createdAt: 1700000000, updatedAt: 1700000000 },
];

describe("ProjectSidebar", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("renders project list", async () => {
    mockInvoke.mockResolvedValue(mockProjects);
    renderWithProviders(
      <ProjectSidebar
        activeProjectId={null}
        onProjectSelect={() => {}}
        onCreateClick={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Project One")).toBeInTheDocument();
      expect(screen.getByText("Project Two")).toBeInTheDocument();
    });
  });

  it("calls onProjectSelect when project is clicked", async () => {
    mockInvoke.mockResolvedValue(mockProjects);
    const onSelect = vi.fn();
    renderWithProviders(
      <ProjectSidebar
        activeProjectId={null}
        onProjectSelect={onSelect}
        onCreateClick={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Project One")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Project One"));
    expect(onSelect).toHaveBeenCalledWith(mockProjects[0]);
  });

  it("shows empty state when no projects", async () => {
    mockInvoke.mockResolvedValue([]);
    renderWithProviders(
      <ProjectSidebar
        activeProjectId={null}
        onProjectSelect={() => {}}
        onCreateClick={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("project.noProjects")).toBeInTheDocument();
    });
  });
});
