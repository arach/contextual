// "What ships in the next call" popover. Lists Fixed modules, Soft items
// inside the window, the current task, and the composer draft.
import type { ContextModule, SoftItem, ThreadTask } from "@/types";
import { fmtTokens } from "@/lib/tokens";

interface ManifestProps {
  callNumber: number;
  fixed: ContextModule[];
  softLive: SoftItem[];
  task: ThreadTask | null;
  draftTokens: number;
  totalTokens: number;
  onClose: () => void;
}

export function Manifest({
  callNumber,
  fixed,
  softLive,
  task,
  draftTokens,
  totalTokens,
  onClose,
}: ManifestProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-full right-0 mb-2 w-[380px] max-h-[60vh] overflow-auto bg-[var(--hg-surface)] border border-[var(--hg-line)] rounded-[2px] px-3.5 py-3 shadow-[0_12px_30px_-16px_rgba(0,0,0,0.7)] z-50"
    >
      <h4 className="m-0 mb-2 text-[11px] text-neutral-500 flex items-baseline gap-2">
        <b className="text-neutral-300">Call {callNumber}</b>
        <span>details</span>
        <span className="flex-1" />
        <button onClick={onClose} className="cursor-pointer text-[var(--hg-muted)] hover:text-[var(--hg-ink)] px-1">
          ×
        </button>
      </h4>
      {fixed.map((m) => (
        <Row key={m.id} dot="fixed" tag={`fix·${m.kind}`} name={m.name} tokens={m.tokens} />
      ))}
      {softLive.map((s) => (
        <Row
          key={s.id}
          dot="soft"
          tag={`sft·${s.kind === "turn" ? s.role : s.kind}`}
          name={s.title}
          tokens={s.tokens}
        />
      ))}
      {task && <Row dot="soft" tag="sft·task" name={task.title} tokens={task.tokens} />}
      {draftTokens > 1 && <Row dot="draft" tag="draft" name="composer draft" tokens={draftTokens} />}
      <div className="mt-2 pt-2 border-t border-[var(--hg-ink)] flex justify-between hg-mono text-[11px] text-[var(--hg-ink)] font-medium tracking-wider uppercase">
        <span>total</span>
        <span>{fmtTokens(totalTokens)} t</span>
      </div>
    </div>
  );
}

function Row({
  dot,
  tag,
  name,
  tokens,
}: {
  dot: "fixed" | "soft" | "draft";
  tag: string;
  name: string;
  tokens: number;
}) {
  const bg =
    dot === "fixed"
      ? "bg-[var(--hg-ink)]"
      : dot === "soft"
        ? "bg-[var(--hg-accent)]"
        : "bg-[var(--hg-accent-deep)]";
  return (
    <div className="flex items-baseline gap-2.5 py-1.5 border-b border-dotted border-[var(--hg-hairline)] last:border-b-0 text-[11.5px]">
      <span className={`w-2 h-2 flex-shrink-0 rounded-full ${bg}`} />
      <span className="hg-mono text-[10px] text-[var(--hg-muted)]">{tag}</span>
      <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
      <span className="hg-mono text-[10px] text-[var(--hg-muted)]">{fmtTokens(tokens)}t</span>
    </div>
  );
}
