import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatMessage } from "../../types/claude";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
  messages: ChatMessage[];
  onSaveMessage?: (messageIndex: number) => void;
  hasEarlierMessages?: boolean;
  onLoadEarlier?: () => void;
  enabled?: boolean;
}

const BOTTOM_THRESHOLD_PX = 50;

export function MessageList({
  messages,
  onSaveMessage,
  hasEarlierMessages = false,
  onLoadEarlier,
  enabled = true,
}: MessageListProps) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const previousMessageCountRef = useRef(messages.length);
  const previousLastSignatureRef = useRef("");
  const [showLoadEarlier, setShowLoadEarlier] = useState(false);

  const virtualizer = useVirtualizer({
    count: enabled ? messages.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
    measureElement: (element) => element.getBoundingClientRect().height,
    initialRect: { width: 0, height: 600 },
    enabled,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const lastMessageSignature = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) {
      return "";
    }

    switch (last.kind) {
      case "assistant-text":
        return `${last.id}:${last.text.length}:${last.streaming}`;
      case "tool-use":
        return `${last.id}:${last.inputJson.length}:${Boolean(last.result)}`;
      default:
        return `${last.id}:${last.text.length}`;
    }
  }, [messages]);

  useEffect(() => {
    if (!enabled || messages.length === 0) {
      previousMessageCountRef.current = messages.length;
      previousLastSignatureRef.current = lastMessageSignature;
      return;
    }

    const shouldScroll =
      isAtBottomRef.current
      && (
        previousMessageCountRef.current !== messages.length
        || previousLastSignatureRef.current !== lastMessageSignature
      );

    if (shouldScroll) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }

    previousMessageCountRef.current = messages.length;
    previousLastSignatureRef.current = lastMessageSignature;
  }, [enabled, lastMessageSignature, messages.length, virtualizer]);

  const handleScroll = useCallback(() => {
    const vp = parentRef.current;
    if (!vp) return;

    isAtBottomRef.current = vp.scrollHeight - vp.scrollTop - vp.clientHeight < BOTTOM_THRESHOLD_PX;
    setShowLoadEarlier(hasEarlierMessages && vp.scrollTop <= BOTTOM_THRESHOLD_PX);
  }, [hasEarlierMessages]);

  return (
    <Box style={{ position: "relative", flex: 1, minHeight: 0 }}>
      {showLoadEarlier && onLoadEarlier && (
        <Button
          size="xs"
          variant="light"
          onClick={onLoadEarlier}
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
          }}
        >
          {t("chat.loadEarlierMessages")}
        </Button>
      )}
      <div
        ref={parentRef}
        onScroll={handleScroll}
        style={{
          height: "100%",
          overflowY: "auto",
          overflowAnchor: "none",
        }}
      >
        <div
          style={{
            height: totalSize,
            position: "relative",
            width: "100%",
          }}
        >
          {virtualItems.map((item) => {
            const msg = messages[item.index];
            if (!msg) {
              return null;
            }

            return (
              <div
                key={msg.id}
                data-index={item.index}
                ref={(node) => {
                  if (node) {
                    virtualizer.measureElement(node);
                  }
                }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  padding: "8px 16px",
                  transform: `translateY(${item.start}px)`,
                  display: "flex",
                }}
              >
                <MessageItem
                  message={msg}
                  onSave={
                    msg.kind === "assistant-text" && !msg.streaming && onSaveMessage
                      ? () => onSaveMessage(item.index)
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    </Box>
  );
}
