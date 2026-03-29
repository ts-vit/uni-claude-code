import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Modal,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  Paper,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconPlayerPlay,
  IconArrowUp,
  IconArrowDown,
  IconCircleCheck,
  IconAlertCircle,
  IconClock,
  IconLoader,
  IconEye,
  IconRefresh,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import type { PipelineTask } from "../types/claude";
import { usePipelineController } from "../hooks/usePipelineController";
import { ChatPanel } from "./chat/ChatPanel";

interface PipelinePageProps {
  projectId: string;
  cwd: string;
  projectModel?: string | null;
}

const statusConfig: Record<string, { color: string; icon: typeof IconClock }> = {
  draft: { color: "gray", icon: IconClock },
  queued: { color: "blue", icon: IconClock },
  discussing: { color: "yellow", icon: IconLoader },
  prompt_ready: { color: "orange", icon: IconCircleCheck },
  executing: { color: "blue", icon: IconLoader },
  done: { color: "green", icon: IconCircleCheck },
  failed: { color: "red", icon: IconAlertCircle },
};

export function PipelinePage({ projectId, cwd, projectModel }: PipelinePageProps) {
  const { t } = useTranslation();
  const pipeline = usePipelineController(projectId, cwd, projectModel);
  const [tasks, setTasks] = useState<PipelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PipelineTask | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [viewingTask, setViewingTask] = useState<PipelineTask | null>(null);
  const [viewMode, setViewMode] = useState<"prompt" | "result">("prompt");
  const [editingPrompt, setEditingPrompt] = useState("");
  const [showLiveView, setShowLiveView] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const data = await invoke<PipelineTask[]>("pipeline_task_list", { projectId });
      setTasks(data);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Auto-refresh tasks while pipeline is running
  useEffect(() => {
    if (pipeline.status !== "running") return;
    const interval = setInterval(() => { loadTasks(); }, 3000);
    return () => clearInterval(interval);
  }, [pipeline.status, loadTasks]);

  // Auto-show live view when pipeline starts
  useEffect(() => {
    if (pipeline.status === "running") {
      setShowLiveView(true);
    }
  }, [pipeline.status]);

  const handleCreate = useCallback(async () => {
    if (!formTitle.trim()) return;
    try {
      await invoke("pipeline_task_create", {
        projectId,
        title: formTitle.trim(),
        description: formDescription.trim(),
      });
      setModalOpen(false);
      setFormTitle("");
      setFormDescription("");
      setEditingTask(null);
      notifications.show({ message: t("pipeline.created"), color: "green" });
      loadTasks();
    } catch (e) {
      notifications.show({ message: `${t("pipeline.createError")}: ${e}`, color: "red" });
    }
  }, [projectId, formTitle, formDescription, loadTasks, t]);

  const handleUpdate = useCallback(async () => {
    if (!editingTask || !formTitle.trim()) return;
    try {
      await invoke("pipeline_task_update", {
        id: editingTask.id,
        title: formTitle.trim(),
        description: formDescription.trim(),
        prompt: editingTask.prompt,
      });
      setModalOpen(false);
      setFormTitle("");
      setFormDescription("");
      setEditingTask(null);
      notifications.show({ message: t("pipeline.updated"), color: "green" });
      loadTasks();
    } catch (e) {
      notifications.show({ message: `${t("pipeline.updateError")}: ${e}`, color: "red" });
    }
  }, [editingTask, formTitle, formDescription, loadTasks, t]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke("pipeline_task_delete", { id });
      notifications.show({ message: t("pipeline.deleted"), color: "green" });
      loadTasks();
    } catch (e) {
      notifications.show({ message: `${t("pipeline.deleteError")}: ${e}`, color: "red" });
    }
  }, [loadTasks, t]);

  const handleMove = useCallback(async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tasks.length) return;
    const newOrder = [...tasks];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    const taskIds = newOrder.map((t) => t.id);
    try {
      await invoke("pipeline_task_reorder", { taskIds });
      loadTasks();
    } catch (e) {
      console.error("Failed to reorder:", e);
    }
  }, [tasks, loadTasks]);

  const handleQueueAll = useCallback(async () => {
    try {
      await invoke("pipeline_queue_all", { projectId });
      notifications.show({ message: t("pipeline.queued"), color: "blue" });
      loadTasks();
    } catch (e) {
      notifications.show({ message: `${e}`, color: "red" });
    }
  }, [projectId, loadTasks, t]);

  const openCreate = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDescription("");
    setModalOpen(true);
  };

  const openEdit = (task: PipelineTask) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description);
    setModalOpen(true);
  };

  const draftCount = tasks.filter((t) => t.status === "draft").length;

  return (
    <Stack gap={0} style={{ height: "100%" }}>
      {/* Toolbar */}
      <Group
        px="md" py={6} gap="sm" justify="space-between"
        style={{ height: 40, minHeight: 40, borderBottom: "1px solid var(--ucc-border-subtle)" }}
      >
        <Group gap="xs">
          <Title order={5}>{t("pipeline.title")}</Title>
          <Badge size="xs" variant="light">{tasks.length} {t("pipeline.tasks")}</Badge>
          {tasks.length > 0 && (() => {
            const done = tasks.filter((t) => t.status === "done").length;
            const failed = tasks.filter((t) => t.status === "failed").length;
            const total = tasks.length;
            const percent = Math.round(((done + failed) / total) * 100);
            return (
              <Group gap={4}>
                <div style={{
                  width: 100, height: 6, borderRadius: 3,
                  backgroundColor: "var(--ucc-border-subtle)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${percent}%`, height: "100%", borderRadius: 3,
                    backgroundColor: failed > 0 ? "var(--mantine-color-yellow-5)" : "var(--mantine-color-green-5)",
                    transition: "width 0.3s",
                  }} />
                </div>
                <Text size="xs" c="dimmed">{done}/{total}</Text>
              </Group>
            );
          })()}
        </Group>
        <Group gap="xs">
          {draftCount > 0 && (
            <Button size="xs" variant="light" color="blue" leftSection={<IconPlayerPlay size={14} />} onClick={handleQueueAll}>
              {t("pipeline.queueAll")}
            </Button>
          )}
          {pipeline.status === "idle" && tasks.some((t) => t.status === "queued") && (
            <Button size="xs" variant="filled" color="green" leftSection={<IconPlayerPlay size={14} />} onClick={pipeline.start}>
              {t("pipeline.start")}
            </Button>
          )}
          {pipeline.status === "running" && (
            <>
              <Button size="xs" variant="light" color="yellow" onClick={pipeline.pause}>
                {t("pipeline.pause")}
              </Button>
              <Button size="xs" variant="light" color="red" onClick={pipeline.stop}>
                {t("pipeline.stop")}
              </Button>
            </>
          )}
          {pipeline.status === "paused" && (
            <>
              <Button size="xs" variant="filled" color="green" leftSection={<IconPlayerPlay size={14} />} onClick={pipeline.resume}>
                {t("pipeline.resume")}
              </Button>
              <Button size="xs" variant="light" color="red" onClick={pipeline.stop}>
                {t("pipeline.stop")}
              </Button>
            </>
          )}
          {pipeline.status === "running" && (
            <Tooltip label={t("pipeline.toggleLive")}>
              <ActionIcon
                size="sm"
                variant={showLiveView ? "filled" : "subtle"}
                color={showLiveView ? "blue" : undefined}
                onClick={() => setShowLiveView((v) => !v)}
              >
                <IconEye size={14} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
          )}
          {pipeline.currentTaskId && (
            <Badge size="sm" variant="dot" color={pipeline.currentPhase === "discuss" ? "yellow" : "blue"}>
              {pipeline.currentPhase === "discuss" ? t("pipeline.discussing") : t("pipeline.executing")}
            </Badge>
          )}
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            {t("pipeline.addTask")}
          </Button>
        </Group>
      </Group>

      {/* Main content: task list + live view */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: task list */}
        <div style={{
          width: showLiveView && pipeline.status === "running" ? "40%" : "100%",
          minWidth: 300,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "width 0.3s",
        }}>
          {loading ? (
            <Stack align="center" justify="center" style={{ flex: 1 }}><Loader size="sm" /></Stack>
          ) : tasks.length === 0 ? (
            <Stack align="center" justify="center" style={{ flex: 1 }} gap="md">
              <Text c="dimmed" size="sm">{t("pipeline.noTasks")}</Text>
              <Button leftSection={<IconPlus size={16} />} variant="light" onClick={openCreate}>
                {t("pipeline.addFirst")}
              </Button>
            </Stack>
          ) : (
            <ScrollArea style={{ flex: 1 }} p="md">
              <Stack gap="xs">
                {tasks.map((task, index) => {
                  const sc = statusConfig[task.status] || statusConfig.draft;
                  const StatusIcon = sc.icon;
                  const isCurrentTask = pipeline.currentTaskId === task.id;
                  return (
                    <Paper key={task.id} withBorder p="sm" radius="md" style={{
                      borderColor: isCurrentTask
                        ? pipeline.currentPhase === "discuss"
                          ? "var(--mantine-color-yellow-5)"
                          : "var(--mantine-color-blue-5)"
                        : "var(--ucc-border-subtle)",
                      borderWidth: isCurrentTask ? 2 : 1,
                      transition: "border-color 0.3s",
                    }}>
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: "hidden" }}>
                          <Text fw={500} size="sm">{index + 1}.</Text>
                          <StatusIcon size={16} color={`var(--mantine-color-${sc.color}-5)`} />
                          <Badge size="xs" color={sc.color} variant="light">{task.status}</Badge>
                          <Text size="sm" fw={500} truncate>{task.title}</Text>
                        </Group>
                        <Group gap={4} wrap="nowrap">
                          {(task.prompt || task.resultSummary || task.errorMessage) && (
                            <Tooltip label={t("pipeline.viewDetails")}>
                              <ActionIcon size="sm" variant="subtle" onClick={() => { setViewingTask(task); setViewMode(task.prompt ? "prompt" : "result"); setEditingPrompt(task.prompt || ""); }}>
                                <IconEye size={14} stroke={1.5} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {task.status === "failed" && (
                            <Tooltip label={t("pipeline.retry")}>
                              <ActionIcon size="sm" variant="subtle" color="orange" onClick={async () => {
                                await invoke("pipeline_task_set_status", { id: task.id, status: "queued" });
                                await invoke("pipeline_task_set_result", { id: task.id, resultSummary: null, errorMessage: null });
                                loadTasks();
                              }}>
                                <IconRefresh size={14} stroke={1.5} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {task.status === "done" && (
                            <Tooltip label={t("pipeline.resetToDraft")}>
                              <ActionIcon size="sm" variant="subtle" color="gray" onClick={async () => {
                                await invoke("pipeline_task_set_status", { id: task.id, status: "draft" });
                                await invoke("pipeline_task_set_result", { id: task.id, resultSummary: null, errorMessage: null });
                                loadTasks();
                              }}>
                                <IconRefresh size={14} stroke={1.5} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          <Tooltip label={t("pipeline.moveUp")}>
                            <ActionIcon size="sm" variant="subtle" onClick={() => handleMove(index, -1)} disabled={index === 0}>
                              <IconArrowUp size={14} stroke={1.5} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t("pipeline.moveDown")}>
                            <ActionIcon size="sm" variant="subtle" onClick={() => handleMove(index, 1)} disabled={index === tasks.length - 1}>
                              <IconArrowDown size={14} stroke={1.5} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t("pipeline.edit")}>
                            <ActionIcon size="sm" variant="subtle" onClick={() => openEdit(task)}>
                              <IconEdit size={14} stroke={1.5} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t("pipeline.delete")}>
                            <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(task.id)}>
                              <IconTrash size={14} stroke={1.5} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                      {task.description && (
                        <Text size="xs" c="dimmed" mt={4} lineClamp={2}>{task.description}</Text>
                      )}
                      {task.resultSummary && (
                        <Text size="xs" c="green" mt={4} lineClamp={1}>✓ {task.resultSummary}</Text>
                      )}
                      {task.errorMessage && (
                        <Text size="xs" c="red" mt={4} lineClamp={1}>✗ {task.errorMessage}</Text>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea>
          )}
        </div>

        {/* Right: live view of pipeline panels */}
        {showLiveView && pipeline.status === "running" && (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--ucc-border-subtle)",
            overflow: "hidden",
          }}>
            {/* Phase indicator */}
            <Group px="sm" py={4} gap="xs" style={{ borderBottom: "1px solid var(--ucc-border-subtle)", minHeight: 28 }}>
              <Badge size="xs" color={pipeline.currentPhase === "discuss" ? "yellow" : "blue"} variant="light">
                {pipeline.currentPhase === "discuss" ? t("pipeline.discussing") : t("pipeline.executing")}
              </Badge>
              {pipeline.currentTaskId && (
                <Text size="xs" c="dimmed" truncate>
                  {tasks.find((tk) => tk.id === pipeline.currentTaskId)?.title}
                </Text>
              )}
            </Group>

            {/* Chat panels — show both, active one visible */}
            <div style={{
              display: pipeline.currentPhase === "discuss" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              overflow: "hidden",
            }}>
              <ChatPanel
                panelId={pipeline.PIPELINE_DISCUSS_PANEL}
                mode="discuss"
                cwd={cwd}
                projectId={projectId}
              />
            </div>
            <div style={{
              display: pipeline.currentPhase === "code" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              overflow: "hidden",
            }}>
              <ChatPanel
                panelId={pipeline.PIPELINE_CODE_PANEL}
                mode="code"
                cwd={cwd}
                projectId={projectId}
                projectModel={projectModel}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pipeline log */}
      {pipeline.log.length > 0 && (
        <Paper withBorder p="sm" mx="md" mb="md" radius="md" style={{ borderColor: "var(--ucc-border-subtle)", maxHeight: 200, overflow: "auto" }}>
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={600}>{t("pipeline.log")}</Text>
            <ActionIcon size="xs" variant="subtle" onClick={pipeline.clearLog}>
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
          <Stack gap={2}>
            {pipeline.log.map((entry, i) => (
              <Text key={i} size="xs" c={entry.type === "error" ? "red" : entry.type === "success" ? "green" : "dimmed"}>
                [{new Date(entry.timestamp).toLocaleTimeString()}] [{entry.phase}] {entry.message}
              </Text>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Create/Edit modal */}
      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        title={editingTask ? t("pipeline.editTask") : t("pipeline.addTask")}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label={t("pipeline.taskTitle")}
            placeholder={t("pipeline.taskTitlePlaceholder")}
            value={formTitle}
            onChange={(e) => setFormTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label={t("pipeline.taskDescription")}
            placeholder={t("pipeline.taskDescriptionPlaceholder")}
            value={formDescription}
            onChange={(e) => setFormDescription(e.currentTarget.value)}
            autosize
            minRows={4}
            maxRows={12}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => { setModalOpen(false); setEditingTask(null); }}>
              {t("common.cancel")}
            </Button>
            <Button onClick={editingTask ? handleUpdate : handleCreate}>
              {editingTask ? t("common.save") : t("pipeline.addTask")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Detail view modal — prompt & result */}
      <Modal
        opened={!!viewingTask}
        onClose={() => setViewingTask(null)}
        title={viewingTask?.title || ""}
        size="xl"
      >
        {viewingTask && (
          <Stack gap="md">
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(v) => setViewMode(v as "prompt" | "result")}
              data={[
                { label: t("pipeline.promptTab"), value: "prompt" },
                { label: t("pipeline.resultTab"), value: "result" },
              ]}
            />

            {viewMode === "prompt" && (
              <Stack gap="sm">
                {viewingTask.status === "draft" || viewingTask.status === "prompt_ready" ? (
                  <>
                    <Textarea
                      value={editingPrompt}
                      onChange={(e) => setEditingPrompt(e.currentTarget.value)}
                      autosize
                      minRows={10}
                      maxRows={25}
                      styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: "var(--mantine-font-size-xs)" } }}
                    />
                    <Group justify="flex-end">
                      <Button size="xs" onClick={async () => {
                        if (!editingPrompt.trim()) return;
                        await invoke("pipeline_task_set_prompt", { id: viewingTask.id, prompt: editingPrompt.trim() });
                        notifications.show({ message: t("pipeline.promptSaved"), color: "green" });
                        loadTasks();
                        setViewingTask(null);
                      }}>
                        {t("pipeline.savePrompt")}
                      </Button>
                    </Group>
                  </>
                ) : (
                  <ScrollArea style={{ maxHeight: 400 }}>
                    <Code block style={{ fontSize: "var(--mantine-font-size-xs)", whiteSpace: "pre-wrap" }}>
                      {viewingTask.prompt || t("pipeline.noPrompt")}
                    </Code>
                  </ScrollArea>
                )}
              </Stack>
            )}

            {viewMode === "result" && (
              <ScrollArea style={{ maxHeight: 400 }}>
                {viewingTask.resultSummary && (
                  <Code block color="green" style={{ fontSize: "var(--mantine-font-size-xs)", whiteSpace: "pre-wrap" }}>
                    {viewingTask.resultSummary}
                  </Code>
                )}
                {viewingTask.errorMessage && (
                  <Code block color="red" style={{ fontSize: "var(--mantine-font-size-xs)", whiteSpace: "pre-wrap", marginTop: viewingTask.resultSummary ? 8 : 0 }}>
                    {viewingTask.errorMessage}
                  </Code>
                )}
                {!viewingTask.resultSummary && !viewingTask.errorMessage && (
                  <Text c="dimmed" size="sm">{t("pipeline.noResult")}</Text>
                )}
              </ScrollArea>
            )}

            {/* Status info */}
            <Group gap="md">
              <Badge color={statusConfig[viewingTask.status]?.color || "gray"} variant="light">
                {viewingTask.status}
              </Badge>
              {viewingTask.startedAt && (
                <Text size="xs" c="dimmed">
                  {t("pipeline.started")}: {new Date(viewingTask.startedAt * 1000).toLocaleTimeString()}
                </Text>
              )}
              {viewingTask.completedAt && (
                <Text size="xs" c="dimmed">
                  {t("pipeline.finished")}: {new Date(viewingTask.completedAt * 1000).toLocaleTimeString()}
                </Text>
              )}
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
