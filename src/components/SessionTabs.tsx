import { Group, ActionIcon, Tooltip, UnstyledButton } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";

export type TabStatus = "idle" | "running" | "error";

export interface SessionTab {
  id: string;
  label: string;
  status: TabStatus;
  closable?: boolean;
}

export interface SessionTabsProps {
  tabs: SessionTab[];
  activeId: string;
  onTabChange: (id: string) => void;
  onTabAdd: () => void;
  onTabClose: (id: string) => void;
  maxTabs?: number;
  addTooltip?: string;
  closeTooltip?: string;
}

const statusColors: Record<TabStatus, string> = {
  idle: "var(--mantine-color-dimmed)",
  running: "var(--mantine-color-green-6)",
  error: "var(--mantine-color-red-6)",
};

export function SessionTabs({
  tabs,
  activeId,
  onTabChange,
  onTabAdd,
  onTabClose,
  maxTabs = 5,
  addTooltip = "New tab",
  closeTooltip = "Close tab",
}: SessionTabsProps) {
  return (
    <Group
      gap={0}
      wrap="nowrap"
      style={{
        borderBottom: "1px solid var(--ucc-border-subtle)",
        minHeight: 30,
        overflow: "hidden",
      }}
    >
      {tabs.map((tab) => (
        <UnstyledButton
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            fontSize: 12,
            borderRight: "1px solid var(--ucc-border-subtle)",
            backgroundColor:
              tab.id === activeId
                ? "var(--mantine-color-default-hover)"
                : "transparent",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {/* Status dot */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: statusColors[tab.status],
              flexShrink: 0,
            }}
          />
          <span>{tab.label}</span>
          {tab.closable !== false && tabs.length > 1 && (
            <Tooltip label={closeTooltip} withArrow position="top">
              <ActionIcon
                variant="subtle"
                size={14}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                style={{ opacity: 0.5 }}
              >
                <IconX size={10} />
              </ActionIcon>
            </Tooltip>
          )}
        </UnstyledButton>
      ))}

      {/* Add tab button */}
      <Tooltip label={addTooltip} withArrow position="top">
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={onTabAdd}
          disabled={tabs.length >= maxTabs}
          style={{ margin: "0 4px" }}
        >
          <IconPlus size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
