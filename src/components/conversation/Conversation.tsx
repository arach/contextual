// Center pane — the conversation. Renders the active thread's soft items as
// turns, summaries, and tool calls, with compaction marks between summary
// groups. Auto-scrolls to bottom on new content.
import { useEffect, useRef } from "react";
import type { Thread } from "@/types";
import { Turn } from "@/components/conversation/Turn";
import { CompactionMark } from "@/components/conversation/CompactionMark";
import { Thinking } from "@/components/conversation/Thinking";

interface ConversationProps {
  thread: Thread;
  thinking: boolean;
  inFlightTokens: number;
}

export function Conversation({ thread, thinking, inFlightTokens }: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.id, thread.soft.length, thinking]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-auto px-9 pt-7 pb-6 hg-mono"
    >
      <CompactionMark label="turns 1–20 · compacted" />
      {thread.soft.map((item, idx) => {
        const prev = thread.soft[idx - 1];
        const isFirstSummaryInGroup = item.kind === "summary" && (!prev || prev.kind !== "summary");
        return (
          <div key={item.id}>
            {isFirstSummaryInGroup && idx > 0 && <CompactionMark label="summary block" />}
            <Turn item={item} />
          </div>
        );
      })}
      {thinking && <Thinking inFlight={inFlightTokens} />}
    </div>
  );
}
