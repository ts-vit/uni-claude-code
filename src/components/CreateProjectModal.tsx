import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, TextInput, Select, Button, Group, ActionIcon } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Project } from "../types/claude";

interface CreateProjectModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export function CreateProjectModal({
  opened,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [cwd, setCwd] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [permissionMode, setPermissionMode] = useState<string>("bypass");
  const [loading, setLoading] = useState(false);

  const selectFolder = async () => {
    const selected = await open({ directory: true });
    if (selected) {
      setCwd(selected as string);
      if (!name) {
        const parts = (selected as string).replace(/\\/g, "/").split("/");
        setName(parts[parts.length - 1] || "");
      }
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !cwd.trim()) return;
    setLoading(true);
    try {
      const project = await invoke<Project>("project_create", {
        name: name.trim(),
        cwd: cwd.trim(),
        model: model || null,
        permissionMode,
      });
      onCreated(project);
      setName("");
      setCwd("");
      setModel(null);
      setPermissionMode("bypass");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setCwd("");
    setModel(null);
    setPermissionMode("bypass");
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("project.create")}
      size="md"
    >
      <TextInput
        label={t("project.name")}
        placeholder={t("project.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        mb="sm"
      />
      <TextInput
        label={t("project.folder")}
        placeholder={t("project.folderPlaceholder")}
        value={cwd}
        onChange={(e) => setCwd(e.currentTarget.value)}
        rightSection={
          <ActionIcon variant="subtle" onClick={selectFolder}>
            <IconFolderOpen size={16} />
          </ActionIcon>
        }
        mb="sm"
      />
      <Select
        label={t("project.model")}
        description={t("project.modelDescription")}
        placeholder={t("settings.claude.modelDescription")}
        value={model}
        onChange={setModel}
        data={[
          { value: "sonnet", label: "Sonnet" },
          { value: "opus", label: "Opus" },
          { value: "haiku", label: "Haiku" },
        ]}
        clearable
        mb="sm"
      />
      <Select
        label={t("project.permissionMode")}
        value={permissionMode}
        onChange={(v) => setPermissionMode(v || "bypass")}
        data={[
          { value: "bypass", label: t("project.permissionBypass") },
          { value: "default", label: t("project.permissionDefault") },
        ]}
        mb="lg"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={handleClose}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleCreate}
          loading={loading}
          disabled={!name.trim() || !cwd.trim()}
        >
          {t("project.create")}
        </Button>
      </Group>
    </Modal>
  );
}
