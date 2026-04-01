import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { ConfirmModal } from "@uni-fw/ui";
import {
  IconFolder,
  IconFolderPlus,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../types/claude";

interface ProjectSidebarProps {
  activeProjectId: string | null;
  onProjectSelect: (project: Project) => void;
  onCreateClick: () => void;
  onProjectsChange?: (projects: Project[]) => void;
}

export function ProjectSidebar({
  activeProjectId,
  onProjectSelect,
  onCreateClick,
  onProjectsChange,
}: ProjectSidebarProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const list = await invoke<Project[]>("project_list");
      setProjects(list);
      onProjectsChange?.(list);
    } catch {
      // ignore
    }
  }, [onProjectsChange]);

  useEffect(() => {
    loadProjects();
  }, [activeProjectId, loadProjects]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await invoke("project_delete", { id: deleteTarget.id });
      setDeleteTarget(null);
      loadProjects();
    } catch {
      // ignore
    }
  };

  return (
    <Stack h="100%" gap={0}>
      <Group px="sm" py="xs" justify="space-between">
        <Text size="xs" fw={600} tt="uppercase" c="dimmed">
          {t("project.projects")}
        </Text>
        <Tooltip label={t("project.create")}>
          <ActionIcon variant="subtle" size="sm" onClick={onCreateClick}>
            <IconFolderPlus size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea style={{ flex: 1 }} px="xs">
        {projects.length === 0 ? (
          <Stack align="center" py="xl" gap="xs">
            <Text size="sm" c="dimmed">
              {t("project.noProjects")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("project.createFirst")}
            </Text>
          </Stack>
        ) : (
          projects.map((project) => (
            <NavLink
              key={project.id}
              label={project.name}
              description={project.model ? `${project.cwd} · ${project.model}` : project.cwd}
              leftSection={<IconFolder size={16} />}
              active={activeProjectId === project.id}
              onClick={() => onProjectSelect(project)}
              rightSection={
                <Group gap={2} onClick={(e) => e.stopPropagation()}>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    c="dimmed"
                    onClick={() => onProjectSelect(project)}
                  >
                    <IconPencil size={12} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    c="red"
                    onClick={() => setDeleteTarget(project)}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Group>
              }
              styles={{
                description: {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 180,
                },
              }}
            />
          ))
        )}
      </ScrollArea>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("project.deleteTitle")}
        message={t("project.deleteConfirm", { name: deleteTarget?.name })}
      />
    </Stack>
  );
}
