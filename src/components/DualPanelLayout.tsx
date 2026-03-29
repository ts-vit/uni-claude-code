import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Group, SegmentedControl } from "@mantine/core";
import { IconColumns, IconLayoutList } from "@tabler/icons-react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ChatPanel } from "./chat/ChatPanel";
import { SessionTabs, type TabStatus } from "./SessionTabs";
import type { PanelEvent } from "../types/claude";

type LayoutMode = "single" | "dual";
type ActivePanel = "discuss" | "code";

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
  const [activePanel, setActivePanel] = useState<ActivePanel>("code");
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dividerHover, setDividerHover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // === Tab state ===
  const [discussTabs, setDiscussTabs] = useState<TabInfo[]>(() => {
    const id = nextTabId("discuss");
    return [{ id, label: "Session 1", status: "idle" as TabStatus }];
  });
  const [discussActiveTab, setDiscussActiveTab] = useState(() => discussTabs[0].id);

  const [codeTabs, setCodeTabs] = useState<TabInfo[]>(() => {
    const id = nextTabId("code");
    return [{ id, label: "Session 1", status: "idle" as TabStatus }];
  });
  const [codeActiveTab, setCodeActiveTab] = useState(() => codeTabs[0].id);

  // === Tab handlers ===
  const handleAddTab = useCallback((side: "discuss" | "code") => {
    const setter = side === "discuss" ? setDiscussTabs : setCodeTabs;
    const activeSetter = side === "discuss" ? setDiscussActiveTab : setCodeActiveTab;
    setter((prev) => {
      if (prev.length >= MAX_TABS_PER_PANEL) return prev;
      const id = nextTabId(side);
      const label = nextTabLabel(prev);
      const newTab: TabInfo = { id, label, status: "idle" };
      activeSetter(id);
      return [...prev, newTab];
    });
  }, []);

  const handleCloseTab = useCallback((side: "discuss" | "code", tabId: string) => {
    const tabs = side === "discuss" ? discussTabs : codeTabs;
    const setter = side === "discuss" ? setDiscussTabs : setCodeTabs;
    const activeSetter = side === "discuss" ? setDiscussActiveTab : setCodeActiveTab;
    const activeTab = side === "discuss" ? discussActiveTab : codeActiveTab;

    if (tabs.length <= 1) return;

    if (activeTab === tabId) {
      const idx = tabs.findIndex((t) => t.id === tabId);
      const newActive = idx > 0 ? tabs[idx - 1].id : tabs[idx + 1]?.id;
      if (newActive) activeSetter(newActive);
    }

    setter((prev) => prev.filter((t) => t.id !== tabId));
    invoke("claude_stop", { panelId: tabId }).catch(() => {});
  }, [discussTabs, codeTabs, discussActiveTab, codeActiveTab]);

  // === Listen to claude-event for tab status updates ===
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<PanelEvent>("claude-event", (event) => {
      const { panel_id, event: runnerEvent } = event.payload;

      const updateStatus = (status: TabStatus) => {
        setDiscussTabs((prev) =>
          prev.map((t) => (t.id === panel_id ? { ...t, status } : t)),
        );
        setCodeTabs((prev) =>
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

  // === Render a panel side ===
  function renderPanelSide(
    side: "discuss" | "code",
    tabs: TabInfo[],
    activeTabId: string,
    onTabChange: (id: string) => void,
    onTabAdd: () => void,
    onTabClose: (id: string) => void,
  ) {
    return (
      <>
        <SessionTabs
          tabs={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            status: tab.status,
            closable: tabs.length > 1,
          }))}
          activeId={activeTabId}
          onTabChange={onTabChange}
          onTabAdd={onTabAdd}
          onTabClose={onTabClose}
          maxTabs={MAX_TABS_PER_PANEL}
          addTooltip={t("panel.newTab")}
          closeTooltip={t("panel.closeTab")}
        />
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              display: tab.id === activeTabId ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ChatPanel panelId={tab.id} mode={side} cwd={cwd} projectId={projectId} projectModel={projectModel} projectPermissionMode={projectPermissionMode} />
          </div>
        ))}
      </>
    );
  }

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
              { label: t("panel.discuss"), value: "discuss" },
              { label: t("panel.code"), value: "code" },
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
        {/* Discuss panel */}
        <div
          style={{
            display: layoutMode === "single" && activePanel !== "discuss" ? "none" : "flex",
            width: layoutMode === "dual" ? `${splitPosition}%` : undefined,
            flex: layoutMode === "single" ? 1 : undefined,
            minWidth: layoutMode === "dual" ? 300 : undefined,
            overflow: "hidden",
            flexDirection: "column",
          }}
        >
          {renderPanelSide(
            "discuss",
            discussTabs,
            discussActiveTab,
            (id) => setDiscussActiveTab(id),
            () => handleAddTab("discuss"),
            (id) => handleCloseTab("discuss", id),
          )}
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

        {/* Code panel */}
        <div
          style={{
            display: layoutMode === "single" && activePanel !== "code" ? "none" : "flex",
            flex: 1,
            minWidth: layoutMode === "dual" ? 300 : undefined,
            overflow: "hidden",
            flexDirection: "column",
          }}
        >
          {renderPanelSide(
            "code",
            codeTabs,
            codeActiveTab,
            (id) => setCodeActiveTab(id),
            () => handleAddTab("code"),
            (id) => handleCloseTab("code", id),
          )}
        </div>
      </div>
    </div>
  );
}
