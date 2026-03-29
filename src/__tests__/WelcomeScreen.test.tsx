import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { WelcomeScreen } from "../components/WelcomeScreen";

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("WelcomeScreen", () => {
  it("renders welcome text", () => {
    renderWithProviders(<WelcomeScreen onCreateProject={() => {}} />);
    expect(screen.getByText("project.welcome")).toBeInTheDocument();
    expect(screen.getByText("project.welcomeDescription")).toBeInTheDocument();
  });

  it("renders Create Project button", () => {
    renderWithProviders(<WelcomeScreen onCreateProject={() => {}} />);
    expect(screen.getByText("project.create")).toBeInTheDocument();
  });

  it("calls onCreateProject when button is clicked", () => {
    const onCreateProject = vi.fn();
    renderWithProviders(<WelcomeScreen onCreateProject={onCreateProject} />);
    fireEvent.click(screen.getByText("project.create"));
    expect(onCreateProject).toHaveBeenCalledOnce();
  });
});
