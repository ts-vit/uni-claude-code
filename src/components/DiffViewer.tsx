import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Badge,
  Group,
  Loader,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconFileDiff,
  IconFileMinus,
  IconFilePlus,
  IconRefresh,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import type { ChangedFile, FileDiff, DiffLine } from "../types/claude";

interface DiffViewerProps {
  cwd: string;
  initialFile?: string;
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const bgColor =
    line.kind === "addition"
      ? "rgba(46, 160, 67, 0.12)"
      : line.kind === "deletion"
        ? "rgba(248, 81, 73, 0.12)"
        : "transparent";

  const textColor =
    line.kind === "addition"
      ? "var(--mantine-color-green-4)"
      : line.kind === "deletion"
        ? "var(--mantine-color-red-4)"
        : undefined;

  const prefix =
    line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";

  return (
    <div
      style={{
        display: "flex",
        fontFamily: "var(--mantine-font-family-monospace)",
        fontSize: "var(--mantine-font-size-xs)",
        backgroundColor: bgColor,
        lineHeight: 1.6,
      }}
    >
      <Text
        size="xs"
        c="dimmed"
        style={{
          width: 45,
          textAlign: "right",
          paddingRight: 8,
          flexShrink: 0,
          userSelect: "none",
          fontFamily: "inherit",
        }}
      >
        {line.oldLine ?? ""}
      </Text>
      <Text
        size="xs"
        c="dimmed"
        style={{
          width: 45,
          textAlign: "right",
          paddingRight: 8,
          flexShrink: 0,
          userSelect: "none",
          fontFamily: "inherit",
        }}
      >
        {line.newLine ?? ""}
      </Text>
      <Text
        size="xs"
        c={textColor}
        style={{
          width: 16,
          textAlign: "center",
          flexShrink: 0,
          fontFamily: "inherit",
          fontWeight: 700,
        }}
      >
        {prefix}
      </Text>
      <Text
        size="xs"
        c={textColor}
        style={{
          flex: 1,
          whiteSpace: "pre",
          overflow: "hidden",
          fontFamily: "inherit",
        }}
      >
        {line.content}
      </Text>
    </div>
  );
}

function DiffContent({ diff }: { diff: FileDiff }) {
  const { t } = useTranslation();

  if (diff.isBinary) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        {t("diff.binaryFile")}
      </Text>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        {t("diff.noChanges")}
      </Text>
    );
  }

  return (
    <Stack gap={0}>
      <Group
        px="md"
        py={6}
        gap="xs"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <Badge size="xs" color="green" variant="light">
          +{diff.additions}
        </Badge>
        <Badge size="xs" color="red" variant="light">
          -{diff.deletions}
        </Badge>
        <Text size="xs" c="dimmed">
          {diff.path}
        </Text>
      </Group>

      {diff.hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx}>
          <Text
            size="xs"
            px="md"
            py={2}
            style={{
              fontFamily: "var(--mantine-font-family-monospace)",
              backgroundColor: "var(--mantine-color-dark-6)",
              color: "var(--mantine-color-blue-4)",
            }}
          >
            {hunk.header}
          </Text>
          {hunk.lines.map((line, lineIdx) => (
            <DiffLineRow key={`${hunkIdx}-${lineIdx}`} line={line} />
          ))}
        </div>
      ))}
    </Stack>
  );
}

export function DiffViewer({ cwd, initialFile }: DiffViewerProps) {
  const { t } = useTranslation();
  const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(
    initialFile ?? null,
  );
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const loadChangedFiles = useCallback(async () => {
    if (!cwd) return;
    setLoadingFiles(true);
    try {
      const files = await invoke<ChangedFile[]>("git_changed_files", { cwd });
      setChangedFiles(files);
    } catch (e) {
      console.error("Failed to load changed files:", e);
    } finally {
      setLoadingFiles(false);
    }
  }, [cwd]);

  useEffect(() => {
    loadChangedFiles();
  }, [loadChangedFiles]);

  const loadDiff = useCallback(
    async (filePath: string) => {
      setSelectedFile(filePath);
      setLoadingDiff(true);
      try {
        const d = await invoke<FileDiff>("file_diff", { cwd, filePath });
        setDiff(d);
      } catch (e) {
        console.error("Failed to load diff:", e);
        setDiff(null);
      } finally {
        setLoadingDiff(false);
      }
    },
    [cwd],
  );

  useEffect(() => {
    if (initialFile) loadDiff(initialFile);
  }, [initialFile, loadDiff]);

  return (
    <Stack gap={0} style={{ height: "calc(100vh - 50px)" }}>
      <Group
        px="md"
        py={6}
        gap="sm"
        justify="space-between"
        style={{
          height: 40,
          minHeight: 40,
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <Group gap="xs">
          <Title order={5}>{t("diff.title")}</Title>
          <Badge size="xs" variant="light">
            {changedFiles.length} {t("diff.filesChanged")}
          </Badge>
        </Group>
        <Tooltip label={t("files.refresh")}>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => {
              loadChangedFiles();
              if (selectedFile) loadDiff(selectedFile);
            }}
          >
            <IconRefresh size={14} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <ScrollArea
          w={250}
          p="xs"
          style={{
            borderRight: "1px solid var(--mantine-color-default-border)",
          }}
        >
          {loadingFiles ? (
            <Stack align="center" py="xl">
              <Loader size="sm" />
            </Stack>
          ) : changedFiles.length === 0 ? (
            <Text c="dimmed" size="xs" ta="center" py="xl">
              {t("diff.noChangedFiles")}
            </Text>
          ) : (
            changedFiles.map((file) => {
              const icon =
                file.status === "deleted" ? (
                  <IconFileMinus size={16} stroke={1.5} />
                ) : file.status === "untracked" ? (
                  <IconFilePlus size={16} stroke={1.5} />
                ) : (
                  <IconFileDiff size={16} stroke={1.5} />
                );

              const statusColor =
                file.status === "modified"
                  ? "yellow"
                  : file.status === "untracked"
                    ? "green"
                    : file.status === "deleted"
                      ? "red"
                      : "gray";

              return (
                <NavLink
                  key={file.path}
                  label={file.path.split("/").pop() || file.path}
                  description={file.path}
                  leftSection={icon}
                  rightSection={
                    <Badge size="xs" color={statusColor} variant="light">
                      {file.status.charAt(0).toUpperCase()}
                    </Badge>
                  }
                  active={selectedFile === file.path}
                  onClick={() => loadDiff(file.path)}
                  styles={{
                    label: { fontSize: "var(--mantine-font-size-xs)" },
                    description: { fontSize: 10 },
                  }}
                />
              );
            })
          )}
        </ScrollArea>

        <ScrollArea style={{ flex: 1 }}>
          {loadingDiff ? (
            <Stack align="center" justify="center" py="xl">
              <Loader size="sm" />
            </Stack>
          ) : diff ? (
            <DiffContent diff={diff} />
          ) : (
            <Text c="dimmed" size="sm" ta="center" py="xl">
              {t("diff.selectFile")}
            </Text>
          )}
        </ScrollArea>
      </div>
    </Stack>
  );
}
