import { useState, useRef, useCallback } from "react";
import { Group, Textarea, ActionIcon, Tooltip } from "@mantine/core";
import { IconSend, IconPlayerStop } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface PromptInputProps {
  isRunning: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function PromptInput({ isRunning, onSend, onStop }: PromptInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isRunning) return;
    onSend(trimmed);
    setValue("");
  }, [value, isRunning, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <Group
      px="md"
      py="sm"
      gap="sm"
      align="flex-end"
      style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
    >
      <Textarea
        ref={textareaRef}
        placeholder={t("chat.placeholder")}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        autosize
        minRows={1}
        maxRows={8}
        disabled={isRunning}
        style={{ flex: 1 }}
      />
      {isRunning ? (
        <Tooltip label={t("chat.stop")}>
          <ActionIcon size="lg" color="red" variant="filled" onClick={onStop}>
            <IconPlayerStop size={18} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <Tooltip label={t("chat.send")}>
          <ActionIcon
            size="lg"
            color="blue"
            variant="filled"
            onClick={handleSend}
            disabled={!value.trim()}
          >
            <IconSend size={18} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}
