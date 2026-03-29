import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell, Text, Group, ActionIcon, Tooltip } from "@mantine/core";
import {
  IconSettings,
  IconHistory,
  IconFolderCode,
  IconFileDescription,
  IconGitCompare,
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
import type { Project } from "./types/claude";
import "./App.css";

type View = "main" | "settings" | "history" | "files" | "claude-md" | "diff";

export function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("main");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [diffInitialFile, setDiffInitialFile] = useState<string | undefined>();

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
      navbar={{ width: 250, breakpoint: "sm" }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={600}>{t("app.title")}</Text>
          <Group gap="sm">
            <SshStatusIndicator />
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
        {view === "settings" ? (
          <SettingsPage />
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
      </AppShell.Main>
      <CreateProjectModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        onCreated={handleProjectCreated}
      />
    </AppShell>
  );
}
