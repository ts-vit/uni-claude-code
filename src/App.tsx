import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell, Text, Group, ActionIcon, Tooltip } from "@mantine/core";
import {
  IconSettings,
  IconHistory,
  IconFolderCode,
  IconFileDescription,
  IconGitCompare,
  IconTerminal,
  IconListCheck,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsPage } from "./components/SettingsPage";
import { DualPanelLayout } from "./components/DualPanelLayout";
import { SshStatusIndicator } from "./components/SshStatusIndicator";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { HistoryPage } from "./components/HistoryPage";
import { FileTreePanel } from "./components/FileTreePanel";
import { ClaudeMdEditor } from "./components/ClaudeMdEditor";
import { DiffViewer } from "./components/DiffViewer";
import { PipelinePage } from "./components/PipelinePage";
import { TerminalPanel } from "@uni-fw/terminal-ui";
import type { Project } from "./types/claude";
import "./App.css";

type View = "main" | "settings" | "history" | "files" | "claude-md" | "diff" | "pipeline";

export function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("main");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [diffInitialFile, setDiffInitialFile] = useState<string | undefined>();
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalPosition, setTerminalPosition] = useState<"bottom" | "right">("bottom");

  const handleProjectSelect = (project: Project) => {
    setActiveProject(project);
    setView("main");
    invoke("project_touch", { id: project.id }).catch(() => {});
  };

  const handleProjectCreated = (project: Project) => {
    setActiveProject(project);
  };

  return (
    <AppShell
      header={{ height: 50 }}
      navbar={{ width: 250, breakpoint: "sm", collapsed: { desktop: view !== "main" && !!activeProject, mobile: view !== "main" && !!activeProject } }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={600}>{t("app.title")}</Text>
          <Group gap="md">
            <SshStatusIndicator />
            <Tooltip label={t("pipeline.title")}>
              <ActionIcon
                variant={view === "pipeline" ? "filled" : "subtle"}
                color={view === "pipeline" ? "blue" : undefined}
                onClick={() => setView((v) => (v === "pipeline" ? "main" : "pipeline"))}
                disabled={!activeProject}
              >
                <IconListCheck size={20} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("files.title")}>
              <ActionIcon
                variant={view === "files" ? "filled" : "subtle"}
                color={view === "files" ? "blue" : undefined}
                onClick={() =>
                  setView((v) => (v === "files" ? "main" : "files"))
                }
                disabled={!activeProject}
              >
                <IconFolderCode size={20} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("diff.title")}>
              <ActionIcon
                variant={view === "diff" ? "filled" : "subtle"}
                color={view === "diff" ? "blue" : undefined}
                onClick={() => {
                  setDiffInitialFile(undefined);
                  setView((v) => (v === "diff" ? "main" : "diff"));
                }}
                disabled={!activeProject}
              >
                <IconGitCompare size={20} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("claudeMd.title")}>
              <ActionIcon
                variant={view === "claude-md" ? "filled" : "subtle"}
                color={view === "claude-md" ? "blue" : undefined}
                onClick={() =>
                  setView((v) =>
                    v === "claude-md" ? "main" : "claude-md",
                  )
                }
                disabled={!activeProject}
              >
                <IconFileDescription size={20} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("history.title")}>
              <ActionIcon
                variant={view === "history" ? "filled" : "subtle"}
                color={view === "history" ? "blue" : undefined}
                onClick={() => setView((v) => (v === "history" ? "main" : "history"))}
                disabled={!activeProject}
              >
                <IconHistory size={20} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("terminal.title")}>
              <ActionIcon
                variant={terminalOpen ? "filled" : "subtle"}
                color={terminalOpen ? "blue" : undefined}
                onClick={() => setTerminalOpen((v) => !v)}
                disabled={!activeProject}
              >
                <IconTerminal size={20} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("common.settings")}>
              <ActionIcon
                variant={view === "settings" ? "filled" : "subtle"}
                color={view === "settings" ? "blue" : undefined}
                onClick={() =>
                  setView((v) => (v === "settings" ? "main" : "settings"))
                }
              >
                <IconSettings size={20} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <ProjectSidebar
          activeProjectId={activeProject?.id ?? null}
          onProjectSelect={handleProjectSelect}
          onCreateClick={() => setCreateModalOpened(true)}
        />
      </AppShell.Navbar>
      <AppShell.Main>
        <div style={{
          display: "flex",
          flexDirection: terminalPosition === "bottom" ? "column" : "row",
          height: "calc(100vh - 50px)",
        }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {view === "settings" ? (
              <SettingsPage />
            ) : view === "pipeline" && activeProject ? (
              <PipelinePage projectId={activeProject.id} cwd={activeProject.cwd} projectModel={activeProject.model} />
            ) : view === "claude-md" && activeProject ? (
              <ClaudeMdEditor cwd={activeProject.cwd} />
            ) : view === "diff" && activeProject ? (
              <DiffViewer cwd={activeProject.cwd} initialFile={diffInitialFile} />
            ) : view === "files" && activeProject ? (
              <FileTreePanel
                cwd={activeProject.cwd}
                onFileSelect={(path) => {
                  setDiffInitialFile(path);
                  setView("diff");
                }}
              />
            ) : view === "history" && activeProject ? (
              <HistoryPage projectId={activeProject.id} />
            ) : activeProject ? (
              <DualPanelLayout cwd={activeProject.cwd} projectId={activeProject.id} projectModel={activeProject.model} projectPermissionMode={activeProject.permissionMode} />
            ) : (
              <WelcomeScreen
                onCreateProject={() => setCreateModalOpened(true)}
              />
            )}
          </div>
          {terminalOpen && activeProject && (
            <TerminalPanel
              height={300}
              width={400}
              position={terminalPosition}
              onPositionChange={setTerminalPosition}
              onClose={() => setTerminalOpen(false)}
            />
          )}
        </div>
      </AppShell.Main>
      <CreateProjectModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        onCreated={handleProjectCreated}
      />
    </AppShell>
  );
}
