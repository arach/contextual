// Center column: header bar (breadcrumb + thread actions) + conversation +
// composer/launch console. Kept thin so App.tsx focuses on wiring state.
import type { Thread } from "@/types";
import { Conversation } from "@/components/conversation/Conversation";
import { Composer } from "@/components/composer/Composer";

interface ConversationAreaProps {
  thread: Thread;
  thinking: boolean;
  inFlightTokens: number;
  onComposerChange: (v: string) => void;
  onDispatch: () => void;
  onBranch: () => void;
  onOpenTree: () => void;
}

export function ConversationArea({
  thread,
  thinking,
  inFlightTokens,
  onComposerChange,
  onDispatch,
  onBranch,
  onOpenTree,
}: ConversationAreaProps) {
  return (
    <section className="flex-1 min-w-0 flex flex-col bg-[var(--hg-bg)]">
      <div className="flex-shrink-0 px-6 py-3 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)] flex items-center gap-3.5">
        <div className="hg-mono text-[11px] text-[var(--hg-muted)] tracking-wider uppercase">
          <b className="text-[var(--hg-ink)] font-medium">{thread.name}</b>
          <span className="text-[var(--hg-hairline)] mx-1.5">/</span>
          <b className="text-[var(--hg-ink)] font-medium">{thread.activeBranch}</b>
          <span className="text-[var(--hg-hairline)] mx-1.5">·</span>
          turn {thread.turn}
          <span className="text-[var(--hg-hairline)] mx-1.5">·</span>
          <span className="text-[var(--hg-accent)]">{thread.status}</span>
        </div>
        <div className="ml-auto flex gap-1.5">
          <button className="hg-btn" type="button" onClick={onOpenTree}>
            /tree
          </button>
          <button className="hg-btn" type="button">
            summarize now
          </button>
          <button className="hg-btn" type="button" onClick={onBranch}>
            branch ⎇
          </button>
          <button className="hg-btn warn" type="button">
            archive
          </button>
        </div>
      </div>

      <Conversation thread={thread} thinking={thinking} inFlightTokens={inFlightTokens} />

      <Composer
        thread={thread}
        thinking={thinking}
        onChange={onComposerChange}
        onDispatch={onDispatch}
      />
    </section>
  );
}
