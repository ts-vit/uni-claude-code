import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell, Text, Group, ActionIcon, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSettings } from "@uni-fw/ui";
import {
  IconSettings,
  IconHistory,
  IconFolderCode,
  IconFileDescription,
  IconGitCompare,
  IconListCheck,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsPage } from "./components/SettingsPage";
import { DualPanelLayout, type DualPanelLayoutState } from "./components/DualPanelLayout";
import { SshStatusIndicator } from "./components/SshStatusIndicator";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { HistoryPage } from "./components/HistoryPage";
import { FileTreePanel } from "./components/FileTreePanel";
import { ClaudeMdEditor } from "./components/ClaudeMdEditor";
import { DiffViewer } from "./components/DiffViewer";
import { PipelinePage } from "./components/PipelinePage";
import type { Project } from "./types/claude";
import "./App.css";

type View = "main" | "settings" | "history" | "files" | "claude-md" | "diff" | "pipeline";

const projectLayoutState = new Map<string, DualPanelLayoutState>();

export function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("main");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [openedProjects, setOpenedProjects] = useState<Project[]>([]);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [diffInitialFile, setDiffInitialFile] = useState<string | undefined>();
  const maxOpenProjectsSetting = useSettings("ui.maxOpenProjects");
  const maxOpenProjects = parseInt(maxOpenProjectsSetting.value ?? "3", 10) || 3;

  const triggerTerminalRefit = () => {
    window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 100);
  };

  const addOpenedProject = (project: Project, currentActiveProjectId: string | null, notifyOnLimit: boolean) => {
    setOpenedProjects((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === project.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = project;
        return next;
      }

      if (prev.length >= maxOpenProjects) {
        const oldestInactive = prev.find((item) => item.id !== currentActiveProjectId);
        const fallbackProject = prev[0];
        const projectToClose = oldestInactive ?? fallbackProject;

        if (!projectToClose) {
          return [project];
        }

        if (notifyOnLimit) {
          notifications.show({
            message: t("project.maxOpenReached", { max: maxOpenProjects }),
            color: "yellow",
            id: "max-open-projects",
          });
        }

        return [...prev.filter((item) => item.id !== projectToClose.id), project];
      }

      return [...prev, project];
    });
  };

  const handleProjectSelect = (project: Project) => {
    const previousActiveProjectId = activeProject?.id ?? null;
    setActiveProject(project);
    setView("main");
    invoke("project_touch", { id: project.id }).catch(() => {});
    addOpenedProject(project, previousActiveProjectId, true);
    triggerTerminalRefit();
  };

  const handleProjectCreated = (project: Project) => {
    const previousActiveProjectId = activeProject?.id ?? null;
    setActiveProject(project);
    setView("main");
    addOpenedProject(project, previousActiveProjectId, false);
    triggerTerminalRefit();
  };

  useEffect(() => {
    setOpenedProjects((prev) => {
      if (prev.length <= maxOpenProjects) {
        return prev;
      }

      const activeProjectId = activeProject?.id ?? null;
      const protectedProject = activeProjectId ? prev.find((project) => project.id === activeProjectId) : null;
      const otherProjects = prev.filter((project) => project.id !== activeProjectId);
      const allowedOtherCount = Math.max(maxOpenProjects - (protectedProject ? 1 : 0), 0);
      const trimmedOthers = otherProjects.slice(-allowedOtherCount);
      return protectedProject ? [...trimmedOthers, protectedProject] : trimmedOthers;
    });
  }, [activeProject, maxOpenProjects]);

  const handleProjectsChange = useCallback((projects: Project[]) => {
    const projectMap = new Map(projects.map((project) => [project.id, project] as const));

    setOpenedProjects((prev) => {
      const next = prev
        .map((project) => projectMap.get(project.id) ?? null)
        .filter((project): project is Project => project !== null);

      if (
        next.length === prev.length
        && next.every((p, i) =>
          p.id === prev[i].id
          && p.name === prev[i].name
          && p.cwd === prev[i].cwd
          && p.model === prev[i].model
          && p.permissionMode === prev[i].permissionMode,
        )
      ) {
        return prev;
      }

      return next;
    });

    setActiveProject((prev) => {
      if (!prev) return null;
      const updated = projectMap.get(prev.id);
      if (!updated) return null;
      if (
        prev.id === updated.id
        && prev.name === updated.name
        && prev.cwd === updated.cwd
        && prev.model === updated.model
        && prev.permissionMode === updated.permissionMode
      ) {
        return prev;
      }
      return updated;
    });
  }, []);

  return (
    <AppShell
      header={{ height: 50 }}
      navbar={{ width: 250, breakpoint: "sm", collapsed: { desktop: view === "pipeline" || (view !== "main" && !!activeProject), mobile: view === "pipeline" || (view !== "main" && !!activeProject) } }}
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
          onProjectsChange={handleProjectsChange}
        />
      </AppShell.Navbar>
      <AppShell.Main>
        <div style={{ height: "calc(100vh - 50px)", overflow: "hidden" }}>
          {view === "settings" ? (
            <SettingsPage />
          ) : view === "pipeline" ? (
            <PipelinePage
              initialProjectId={activeProject?.id}
              onProjectSelect={handleProjectSelect}
            />
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
            <>
              {openedProjects
                .filter((project) => project.id === activeProject.id && view === "main")
                .map((project) => (
                <div
                  key={project.id}
                  style={{
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    height: "100%",
                    overflow: "hidden",
                  }}
                >
                  <DualPanelLayout
                    cwd={project.cwd}
                    projectId={project.id}
                    projectModel={project.model}
                    projectPermissionMode={project.permissionMode}
                    initialState={projectLayoutState.get(project.id)}
                    onStateChange={(state) => {
                      projectLayoutState.set(project.id, state);
                    }}
                  />
                </div>
                ))}
            </>
          ) : (
            <WelcomeScreen
              onCreateProject={() => setCreateModalOpened(true)}
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
