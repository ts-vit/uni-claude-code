import { useState, useRef, useCallback } from "react";
import { Textarea, ActionIcon, Tooltip, Group, Badge, CloseButton } from "@mantine/core";
import { IconSend, IconPlayerStop, IconPaperclip, IconFile, IconPhoto } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface PromptInputProps {
  isRunning: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  placeholder?: string;
}

function getFileName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function isImageFile(path: string): boolean {
  const ext = path.toLowerCase().split(".").pop() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
}

export function PromptInput({ isRunning, onSend, onStop, placeholder }: PromptInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || isRunning) return;

    let prompt = "";
    if (attachments.length > 0) {
      prompt += "Attached files:\n";
      for (const path of attachments) {
        prompt += `- ${path}\n`;
      }
      prompt += "\n";
    }
    prompt += trimmed;

    onSend(prompt);
    setValue("");
    setAttachments([]);
  }, [value, attachments, isRunning, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        try {
          const savedPath = await invoke<string | null>("clipboard_save_image");
          if (savedPath) {
            setAttachments((prev) => [...prev, savedPath]);
          }
        } catch (err) {
          console.error("Failed to save clipboard image:", err);
        }
        return;
      }
    }
  }, []);

  const handleAttachFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "Files",
            extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "pdf", "txt", "md", "ts", "tsx", "js", "rs", "toml", "json", "csv"],
          },
        ],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        setAttachments((prev) => [...prev, ...paths.map(String)]);
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--ucc-border-subtle)" }}>
      {attachments.length > 0 && (
        <Group gap={4} mb={6} style={{ maxWidth: 900, margin: "0 auto 6px", flexWrap: "wrap" }}>
          {attachments.map((path, i) => (
            <Badge
              key={i}
              size="sm"
              variant="outline"
              radius="sm"
              leftSection={
                isImageFile(path)
                  ? <IconPhoto size={12} stroke={1.5} />
                  : <IconFile size={12} stroke={1.5} />
              }
              rightSection={
                <CloseButton size={14} variant="transparent" onClick={() => removeAttachment(i)} />
              }
              styles={{
                root: {
                  borderColor: "var(--ucc-border-subtle)",
                  backgroundColor: "var(--ucc-bg-panel)",
                  maxWidth: 250,
                  textTransform: "none",
                  fontWeight: 400,
                },
                label: { overflow: "hidden", textOverflow: "ellipsis" },
              }}
            >
              {getFileName(path)}
            </Badge>
          ))}
        </Group>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          backgroundColor: "var(--ucc-bg-input)",
          borderRadius: 12,
          border: focused ? "1px solid var(--mantine-color-brand-5)" : "1px solid var(--ucc-border-subtle)",
          boxShadow: focused ? "var(--ucc-shadow-glow-orange)" : "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          padding: "6px 8px 6px 14px",
          maxWidth: 900,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Tooltip label={t("chat.attach")}>
          <ActionIcon
            size="md"
            variant="subtle"
            onClick={handleAttachFile}
            disabled={isRunning}
            style={{ flexShrink: 0, marginRight: 4, alignSelf: "flex-end" }}
          >
            <IconPaperclip size={18} stroke={1.5} />
          </ActionIcon>
        </Tooltip>

        <Textarea
          ref={textareaRef}
          placeholder={placeholder ?? t("chat.placeholder")}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={handlePaste}
          autosize
          minRows={1}
          maxRows={8}
          disabled={isRunning}
          variant="unstyled"
          style={{ flex: 1 }}
          styles={{ input: { padding: 0, fontSize: "var(--mantine-font-size-sm)", border: "none", outline: "none", background: "transparent" } }}
        />

        {isRunning ? (
          <Tooltip label={t("chat.stop")}>
            <ActionIcon size="lg" color="red" variant="filled" onClick={onStop} radius="xl" style={{ flexShrink: 0, marginLeft: 8 }}>
              <IconPlayerStop size={18} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Tooltip label={t("chat.send")}>
            <ActionIcon size="lg" color="brand" variant="filled" onClick={handleSend} disabled={!value.trim() && attachments.length === 0} radius="xl" style={{ flexShrink: 0, marginLeft: 8 }}>
              <IconSend size={18} stroke={1.5} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
