import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { MarkdownRenderer } from "@uni-fw/ui";
import {
  IconDeviceFloppy,
  IconEdit,
  IconEye,
  IconFilePlus,
  IconRefresh,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeMdInfo } from "../types/claude";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  return "";
}

function H1(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 id={slugify(extractText(props.children))} {...props} />;
}
function H2(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 id={slugify(extractText(props.children))} {...props} />;
}
function H3(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 id={slugify(extractText(props.children))} {...props} />;
}
function H4(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h4 id={slugify(extractText(props.children))} {...props} />;
}
function H5(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 id={slugify(extractText(props.children))} {...props} />;
}
function H6(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h6 id={slugify(extractText(props.children))} {...props} />;
}

const markdownComponents = { h1: H1, h2: H2, h3: H3, h4: H4, h5: H5, h6: H6 };

interface ClaudeMdEditorProps {
  cwd: string;
}

const CLAUDE_MD_TEMPLATE = `# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Describe your project here.

## Commands

\`\`\`bash
# Development
npm run dev

# Build
npm run build

# Tests
npm run test
\`\`\`

## Architecture

Describe your architecture here.

## Key Patterns

Describe key patterns and conventions here.
`;

export function ClaudeMdEditor({ cwd }: ClaudeMdEditorProps) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<ClaudeMdInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const loadClaudeMd = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<ClaudeMdInfo>("claude_md_read", { cwd });
      setInfo(data);
      setEditContent(data.content);
      setHasChanges(false);
    } catch (e) {
      console.error("Failed to load CLAUDE.md:", e);
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    loadClaudeMd();
  }, [loadClaudeMd]);

  const handleSave = useCallback(async () => {
    try {
      await invoke("claude_md_write", { cwd, content: editContent });
      setHasChanges(false);
      const data = await invoke<ClaudeMdInfo>("claude_md_read", { cwd });
      setInfo(data);
      notifications.show({ message: t("claudeMd.saved"), color: "green" });
    } catch (e) {
      notifications.show({
        message: `${t("claudeMd.saveError")}: ${e}`,
        color: "red",
      });
    }
  }, [cwd, editContent, t]);

  const handleCreate = useCallback(async () => {
    try {
      await invoke("claude_md_write", { cwd, content: CLAUDE_MD_TEMPLATE });
      await loadClaudeMd();
      setEditMode(true);
      notifications.show({ message: t("claudeMd.created"), color: "green" });
    } catch (e) {
      notifications.show({
        message: `${t("claudeMd.createError")}: ${e}`,
        color: "red",
      });
    }
  }, [cwd, loadClaudeMd, t]);

  return (
    <Stack gap={0} style={{ height: "calc(100vh - 50px)" }}>
      {/* Toolbar */}
      <Group
        px="md"
        py={6}
        gap="sm"
        justify="space-between"
        style={{
          height: 40,
          minHeight: 40,
          borderBottom: "1px solid var(--ucc-border-subtle)",
        }}
      >
        <Group gap="xs">
          <Title order={5}>{t("claudeMd.title")}</Title>
          {info?.exists && (
            <Text size="xs" c="dimmed">
              {info.path}
            </Text>
          )}
          {hasChanges && (
            <Badge size="xs" color="yellow" variant="light">
              {t("claudeMd.unsaved")}
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          {info?.exists && (
            <>
              <Tooltip
                label={
                  editMode ? t("claudeMd.preview") : t("claudeMd.edit")
                }
              >
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  {editMode ? (
                    <IconEye size={16} stroke={1.5} />
                  ) : (
                    <IconEdit size={16} stroke={1.5} />
                  )}
                </ActionIcon>
              </Tooltip>
              {editMode && hasChanges && (
                <Tooltip label={t("claudeMd.save")}>
                  <ActionIcon
                    variant="filled"
                    size="sm"
                    color="green"
                    onClick={handleSave}
                  >
                    <IconDeviceFloppy size={16} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label={t("files.refresh")}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={loadClaudeMd}
                >
                  <IconRefresh size={14} stroke={1.5} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      </Group>

      {/* Content */}
      {loading ? (
        <Stack align="center" justify="center" style={{ flex: 1 }}>
          <Loader size="sm" />
        </Stack>
      ) : !info?.exists ? (
        <Stack align="center" justify="center" style={{ flex: 1 }} gap="md">
          <IconFilePlus
            size={48}
            stroke={1}
            color="var(--mantine-color-dimmed)"
          />
          <Text c="dimmed" size="sm">
            {t("claudeMd.notFound")}
          </Text>
          <Button
            leftSection={<IconFilePlus size={16} />}
            variant="light"
            onClick={handleCreate}
          >
            {t("claudeMd.create")}
          </Button>
        </Stack>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* TOC sidebar */}
          {info.toc.length > 0 && !editMode && (
            <ScrollArea
              w={200}
              p="xs"
              style={{
                borderRight:
                  "1px solid var(--ucc-border-subtle)",
              }}
            >
              <Text size="xs" fw={600} mb="xs" c="dimmed">
                {t("claudeMd.tableOfContents")}
              </Text>
              {info.toc.map((entry, i) => (
                <NavLink
                  key={i}
                  label={entry.text}
                  style={{
                    paddingLeft: 8 + entry.indent * 12,
                    fontSize: "var(--mantine-font-size-xs)",
                  }}
                  active={false}
                  variant="subtle"
                  onClick={() => {
                    const el = document.getElementById(slugify(entry.text));
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              ))}
            </ScrollArea>
          )}

          {/* Editor or Preview */}
          <ScrollArea style={{ flex: 1 }} p="md">
            {editMode ? (
              <Textarea
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.currentTarget.value);
                  setHasChanges(e.currentTarget.value !== info.content);
                }}
                autosize
                minRows={20}
                styles={{
                  input: {
                    fontFamily: "var(--mantine-font-family-monospace)",
                    fontSize: "var(--mantine-font-size-sm)",
                  },
                }}
              />
            ) : (
              <MarkdownRenderer content={info.content} components={markdownComponents} />
            )}
          </ScrollArea>
        </div>
      )}
    </Stack>
  );
}
