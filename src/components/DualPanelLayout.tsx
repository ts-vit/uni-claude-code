import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Group, SegmentedControl } from "@mantine/core";
import { IconColumns, IconLayoutList } from "@tabler/icons-react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ChatPanel } from "./chat/ChatPanel";
import { SessionTabs, type TabStatus } from "./SessionTabs";
import { TerminalPanel } from "@uni-fw/terminal-ui";
import type { PanelEvent } from "../types/claude";

type LayoutMode = "single" | "dual";
type ActivePanel = "architect" | "terminal";

interface TabInfo {
  id: string;
  label: string;
  status: TabStatus;
}

const MAX_TABS_PER_PANEL = 5;
let tabCounter = 0;
function nextTabId(prefix: string): string {
  tabCounter += 1;
  return `${prefix}-${tabCounter}`;
}
function nextTabLabel(tabs: TabInfo[]): string {
  return `Session ${tabs.length + 1}`;
}

interface DualPanelLayoutProps {
  cwd: string;
  projectId: string;
  projectModel?: string | null;
  projectPermissionMode?: string;
}

export function DualPanelLayout({ cwd, projectId, projectModel, projectPermissionMode }: DualPanelLayoutProps) {
  const { t } = useTranslation();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("single");
  const [activePanel, setActivePanel] = useState<ActivePanel>("terminal");
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dividerHover, setDividerHover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // === Tab state (Architect panel only) ===
  const [discussTabs, setDiscussTabs] = useState<TabInfo[]>(() => {
    const id = nextTabId("discuss");
    return [{ id, label: "Session 1", status: "idle" as TabStatus }];
  });
  const [discussActiveTab, setDiscussActiveTab] = useState(() => discussTabs[0].id);

  // === Tab handlers ===
  const handleAddTab = useCallback(() => {
    setDiscussTabs((prev) => {
      if (prev.length >= MAX_TABS_PER_PANEL) return prev;
      const id = nextTabId("discuss");
      const label = nextTabLabel(prev);
      const newTab: TabInfo = { id, label, status: "idle" };
      setDiscussActiveTab(id);
      return [...prev, newTab];
    });
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
    if (discussTabs.length <= 1) return;

    if (discussActiveTab === tabId) {
      const idx = discussTabs.findIndex((t) => t.id === tabId);
      const newActive = idx > 0 ? discussTabs[idx - 1].id : discussTabs[idx + 1]?.id;
      if (newActive) setDiscussActiveTab(newActive);
    }

    setDiscussTabs((prev) => prev.filter((t) => t.id !== tabId));
    invoke("claude_stop", { panelId: tabId }).catch(() => {});
  }, [discussTabs, discussActiveTab]);

  // === Listen to claude-event for tab status updates ===
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<PanelEvent>("claude-event", (event) => {
      const { panel_id, event: runnerEvent } = event.payload;

      const updateStatus = (status: TabStatus) => {
        setDiscussTabs((prev) =>
          prev.map((t) => (t.id === panel_id ? { ...t, status } : t)),
        );
      };

      if ("ProcessExited" in runnerEvent) {
        updateStatus("idle");
      } else if ("Claude" in runnerEvent) {
        const ce = runnerEvent.Claude;
        if (ce.type === "result" && ce.is_error) {
          updateStatus("error");
        } else if (ce.type === "result") {
          updateStatus("idle");
        } else {
          updateStatus("running");
        }
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // === Drag resize ===
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPosition(Math.min(80, Math.max(20, percent)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = "col-resize";
      return () => {
        document.body.style.cursor = "";
      };
    }
  }, [isDragging]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <Group
        px="md"
        gap="sm"
        align="center"
        style={{
          height: 36,
          minHeight: 36,
          borderBottom: "1px solid var(--ucc-border-subtle)",
        }}
      >
        {/* Left: layout mode */}
        <SegmentedControl
          size="xs"
          value={layoutMode}
          onChange={(v) => setLayoutMode(v as LayoutMode)}
          data={[
            { label: <IconLayoutList size={14} />, value: "single" },
            { label: <IconColumns size={14} />, value: "dual" },
          ]}
        />

        {/* Right: panel switcher (single mode only) */}
        {layoutMode === "single" && (
          <SegmentedControl
            size="xs"
            value={activePanel}
            onChange={(v) => setActivePanel(v as ActivePanel)}
            data={[
              { label: t("panel.architect"), value: "architect" },
              { label: t("panel.terminal"), value: "terminal" },
            ]}
          />
        )}
      </Group>

      {/* Panel area */}
      <div
        ref={containerRef}
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          userSelect: isDragging ? "none" : undefined,
        }}
      >
        {/* Architect panel */}
        <div
          style={{
            display: layoutMode === "single" && activePanel !== "architect" ? "none" : "flex",
            width: layoutMode === "dual" ? `${splitPosition}%` : undefined,
            flex: layoutMode === "single" ? 1 : undefined,
            minWidth: layoutMode === "dual" ? 300 : undefined,
            overflow: "hidden",
            flexDirection: "column",
          }}
        >
          <SessionTabs
            tabs={discussTabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              status: tab.status,
              closable: discussTabs.length > 1,
            }))}
            activeId={discussActiveTab}
            onTabChange={(id) => setDiscussActiveTab(id)}
            onTabAdd={handleAddTab}
            onTabClose={(id) => handleCloseTab(id)}
            maxTabs={MAX_TABS_PER_PANEL}
            addTooltip={t("panel.newTab")}
            closeTooltip={t("panel.closeTab")}
          />
          {discussTabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                display: tab.id === discussActiveTab ? "flex" : "none",
                flex: 1,
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <ChatPanel panelId={tab.id} mode="discuss" cwd={cwd} projectId={projectId} projectModel={projectModel} projectPermissionMode={projectPermissionMode} />
            </div>
          ))}
        </div>

        {/* Divider — only in dual mode */}
        {layoutMode === "dual" && (
          <div
            style={{
              width: 5,
              cursor: "col-resize",
              backgroundColor: isDragging
                ? "var(--mantine-color-blue-5)"
                : dividerHover
                  ? "rgba(255, 255, 255, 0.1)"
                  : "var(--ucc-border-subtle)",
              flexShrink: 0,
              transition: isDragging ? "none" : "background-color 0.15s",
            }}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setDividerHover(true)}
            onMouseLeave={() => setDividerHover(false)}
          />
        )}

        {/* Terminal panel */}
        <div
          style={{
            display: layoutMode === "single" && activePanel !== "terminal" ? "none" : "flex",
            flex: 1,
            minWidth: layoutMode === "dual" ? 300 : undefined,
            overflow: "hidden",
            flexDirection: "column",
          }}
          className="terminal-embed"
        >
          <TerminalPanel
            height={0}
            width={0}
            position="right"
            onPositionChange={() => {}}
            onClose={() => {}}
            cwd={cwd}
          />
        </div>
      </div>
    </div>
  );
}
