import { Group, ActionIcon, Tooltip, Menu } from "@mantine/core";
import { IconPlus, IconX, IconEye, IconCode, IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export type TabStatus = "idle" | "running" | "error";
export type TabMode = "architect" | "developer";

export interface SessionTab {
  id: string;
  label: string;
  status: TabStatus;
  mode?: TabMode;
  closable?: boolean;
}

export interface SessionTabsProps {
  tabs: SessionTab[];
  activeId: string;
  onTabChange: (id: string) => void;
  onTabAdd: () => void;
  onTabClose: (id: string) => void;
  onTabModeChange?: (id: string, mode: TabMode) => void;
  maxTabs?: number;
  addTooltip?: string;
  closeTooltip?: string;
}

const statusColors: Record<TabStatus, string> = {
  idle: "var(--mantine-color-dimmed)",
  running: "var(--mantine-color-green-6)",
  error: "var(--mantine-color-red-6)",
};

const modeColors: Record<TabMode, string> = {
  architect: "var(--mantine-color-blue-5)",
  developer: "var(--mantine-color-orange-6)",
};

export function SessionTabs({
  tabs,
  activeId,
  onTabChange,
  onTabAdd,
  onTabClose,
  onTabModeChange,
  maxTabs = 5,
  addTooltip = "New tab",
  closeTooltip = "Close tab",
}: SessionTabsProps) {
  const { t } = useTranslation();

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
      {tabs.map((tab) => {
        const mode: TabMode = tab.mode ?? "architect";
        const ModeIcon = mode === "developer" ? IconCode : IconEye;

        return (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTabChange(tab.id);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px 4px 14px",
              minWidth: 140,
              fontSize: 12,
              borderRight: "1px solid var(--ucc-border-subtle)",
              backgroundColor:
                tab.id === activeId
                  ? "var(--mantine-color-default-hover)"
                  : "transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              userSelect: "none",
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
                marginRight: 4,
              }}
            />
            <span>{tab.label}</span>

            {onTabModeChange ? (
              <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center" }}>
                <Menu position="bottom-start" withArrow shadow="md" width={220}>
                  <Menu.Target>
                    <Tooltip
                      label={t(mode === "developer" ? "panel.modeDeveloperTooltip" : "panel.modeArchitectTooltip")}
                      withArrow
                      position="top"
                    >
                      <ActionIcon
                        variant="light"
                        size={28}
                        w={44}
                        color={mode === "developer" ? "orange" : "blue"}
                        aria-label={t("panel.modeLabel")}
                        style={{ marginLeft: 4 }}
                      >
                        <Group gap={4} wrap="nowrap">
                          <ModeIcon size={14} />
                          <IconChevronDown size={14} stroke={2.5} />
                        </Group>
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>{t("panel.modeLabel")}</Menu.Label>
                    <Menu.Item
                      leftSection={<IconEye size={14} color={modeColors.architect} />}
                      rightSection={mode === "architect" ? <IconCheck size={12} /> : null}
                      onClick={() => onTabModeChange(tab.id, "architect")}
                    >
                      {t("panel.modeArchitect")}
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconCode size={14} color={modeColors.developer} />}
                      rightSection={mode === "developer" ? <IconCheck size={12} /> : null}
                      onClick={() => onTabModeChange(tab.id, "developer")}
                    >
                      {t("panel.modeDeveloper")}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </div>
            ) : null}

            {tab.closable !== false && tabs.length > 1 && (
              <div onClick={(e) => e.stopPropagation()} style={{ display: "flex" }}>
                <Tooltip label={closeTooltip} withArrow position="top">
                  <ActionIcon
                    variant="subtle"
                    size={14}
                    onClick={() => onTabClose(tab.id)}
                    style={{ opacity: 0.5 }}
                  >
                    <IconX size={10} />
                  </ActionIcon>
                </Tooltip>
              </div>
            )}
          </div>
        );
      })}

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
