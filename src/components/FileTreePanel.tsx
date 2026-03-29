import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Badge,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconGitBranch,
  IconRefresh,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import type { FileTreeNode, GitBranchInfo } from "../types/claude";

interface FileTreePanelProps {
  cwd: string;
  onFileSelect?: (filePath: string) => void;
}

function TreeItem({
  node,
  depth,
  expandedPaths,
  selectedPath,
  onToggle,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const statusColor =
    node.status === "modified"
      ? "yellow"
      : node.status === "untracked" || node.status === "added"
        ? "green"
        : node.status === "deleted"
          ? "red"
          : undefined;

  const statusLetter =
    node.status === "modified"
      ? "M"
      : node.status === "untracked"
        ? "U"
        : node.status === "added"
          ? "A"
          : node.status === "deleted"
            ? "D"
            : node.status === "renamed"
              ? "R"
              : null;

  return (
    <>
      <UnstyledButton
        onClick={() => {
          if (node.isDir) {
            onToggle(node.path);
          } else {
            onSelect(node.path);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: 8 + depth * 16,
          paddingRight: 8,
          paddingTop: 2,
          paddingBottom: 2,
          width: "100%",
          backgroundColor: isSelected
            ? "var(--mantine-color-dark-5)"
            : "transparent",
          borderRadius: 4,
          fontSize: "var(--mantine-font-size-xs)",
        }}
      >
        {node.isDir ? (
          isExpanded ? (
            <IconChevronDown
              size={14}
              stroke={1.5}
              style={{ flexShrink: 0 }}
            />
          ) : (
            <IconChevronRight
              size={14}
              stroke={1.5}
              style={{ flexShrink: 0 }}
            />
          )
        ) : (
          <div style={{ width: 14, flexShrink: 0 }} />
        )}

        {node.isDir ? (
          isExpanded ? (
            <IconFolderOpen
              size={16}
              stroke={1.5}
              color="var(--mantine-color-blue-5)"
              style={{ flexShrink: 0 }}
            />
          ) : (
            <IconFolder
              size={16}
              stroke={1.5}
              color="var(--mantine-color-blue-5)"
              style={{ flexShrink: 0 }}
            />
          )
        ) : (
          <IconFile size={16} stroke={1.5} style={{ flexShrink: 0 }} />
        )}

        <Text size="xs" truncate style={{ flex: 1 }} c={statusColor}>
          {node.name}
        </Text>

        {statusLetter && (
          <Text size="xs" c={statusColor} fw={700} style={{ flexShrink: 0 }}>
            {statusLetter}
          </Text>
        )}
      </UnstyledButton>

      {node.isDir &&
        isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

export function FileTreePanel({ cwd, onFileSelect }: FileTreePanelProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<GitBranchInfo | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const loadTree = useCallback(async () => {
    if (!cwd) return;
    setLoading(true);
    try {
      const [treeData, branchData] = await Promise.all([
        invoke<FileTreeNode[]>("file_tree", { cwd, maxDepth: 4 }),
        invoke<GitBranchInfo>("git_branch_info", { cwd }).catch(() => null),
      ]);
      setTree(treeData);
      setBranch(branchData);
    } catch (e) {
      console.error("Failed to load file tree:", e);
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  return (
    <Stack gap={0} style={{ height: "100%", overflow: "hidden" }}>
      <Group
        px="sm"
        py={6}
        gap="xs"
        justify="space-between"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <Group gap="xs">
          <Text size="xs" fw={600}>
            {t("files.title")}
          </Text>
          {branch?.name && (
            <Badge
              size="xs"
              variant="light"
              leftSection={<IconGitBranch size={10} />}
            >
              {branch.name}
            </Badge>
          )}
        </Group>
        <Tooltip label={t("files.refresh")}>
          <ActionIcon variant="subtle" size="xs" onClick={loadTree}>
            <IconRefresh size={14} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {loading ? (
        <Stack align="center" justify="center" style={{ flex: 1 }}>
          <Loader size="sm" />
        </Stack>
      ) : tree.length === 0 ? (
        <Stack align="center" justify="center" style={{ flex: 1 }}>
          <Text size="sm" c="dimmed">
            {t("files.noFiles")}
          </Text>
        </Stack>
      ) : (
        <ScrollArea style={{ flex: 1 }} px={4} py={4}>
          {tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              onToggle={(path) => {
                setExpandedPaths((prev) => {
                  const next = new Set(prev);
                  if (next.has(path)) next.delete(path);
                  else next.add(path);
                  return next;
                });
              }}
              onSelect={(path) => {
                setSelectedPath(path);
                onFileSelect?.(path);
              }}
            />
          ))}
        </ScrollArea>
      )}
    </Stack>
  );
}
