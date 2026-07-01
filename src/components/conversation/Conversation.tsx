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
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto px-6 pt-8 pb-4">
      <div className="max-w-[720px] mx-auto">
        <CompactionMark label="Earlier · turns 1–20 summarized" />
        {thread.soft.map((item, idx) => {
          const prev = thread.soft[idx - 1];
          const isFirstSummaryInGroup =
            item.kind === "summary" && (!prev || prev.kind !== "summary");
          return (
            <div key={item.id}>
              {isFirstSummaryInGroup && idx > 0 && (
                <CompactionMark label="Summary" />
              )}
              <Turn item={item} />
            </div>
          );
        })}
        {thinking && <Thinking inFlight={inFlightTokens} />}
      </div>
    </div>
  );
}
