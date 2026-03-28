import { useEffect, useRef } from "react";
import { Stack, ScrollArea } from "@mantine/core";
import type { ChatMessage } from "../../types/claude";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    if (isAtBottomRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const threshold = 50;
    isAtBottomRef.current = vp.scrollHeight - vp.scrollTop - vp.clientHeight < threshold;
  };

  return (
    <ScrollArea
      style={{ flex: 1 }}
      viewportRef={viewportRef}
      onScrollPositionChange={handleScroll}
    >
      <Stack gap="sm" p="md">
        {messages.map((msg, i) => (
          <MessageItem key={i} message={msg} />
        ))}
      </Stack>
    </ScrollArea>
  );
}
