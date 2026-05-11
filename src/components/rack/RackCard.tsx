// A compact row in the rack — the Hangar take on the card metaphor.
// Click to expand; expanded shows full body + inline controls (pin, summarize,
// drop). The card metaphor has been intentionally stripped here per the
// user's note ("this view much more focused on pinning/unpinning, without
// necessarily the card vibe — concise preview").

import type { ReactNode } from "react";
import type { ContextModule, SoftItem, ThreadTask } from "@/types";
import { fmtTokens } from "@/lib/tokens";

type RackItem =
  | { source: "fixed"; module: ContextModule }
  | { source: "soft"; soft: SoftItem }
  | { source: "task"; task: ThreadTask };

interface RackCardProps {
  item: RackItem;
  expanded: boolean;
  evicted?: boolean;
  onExpand: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onDrop?: () => void;
}

export function RackCard({
  item,
  expanded,
  evicted = false,
  onExpand,
  onPin,
  onUnpin,
  onDrop,
}: RackCardProps) {
  const view = resolveView(item);
  return (
    <div
      onClick={onExpand}
      className={
        "relative cursor-pointer py-2 pl-3 pr-2 border-b border-[var(--hg-hairline)] transition-colors " +
        (expanded
          ? "bg-[rgba(255,123,44,0.04)] hg-reticle "
          : "hover:bg-[var(--hg-surface)] ") +
        zoneStyles(item.source, view.kind) +
        (evicted ? " opacity-40" : "")
      }
      style={
        evicted
          ? {
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 6px, rgba(184,89,58,0.08) 6px 8px)",
              borderStyle: "dashed",
            }
          : undefined
      }
    >
      {evicted && (
        <span className="absolute right-2 top-1.5 hg-mono text-[9px] tracking-wider uppercase text-[var(--hg-warn)]">
          evicted by budget
        </span>
      )}
      <div className="flex items-center gap-2">
        <KindChip kind={view.kind}>{view.kind}</KindChip>
        <span className="text-[12px] font-medium text-[var(--hg-ink)] flex-1 min-w-0 truncate">
          {view.name}
        </span>
        {view.age && (
          <span className="hg-mono text-[10px] text-[var(--hg-muted)] flex-shrink-0">{view.age}</span>
        )}
        <span className="hg-mono text-[10px] text-[var(--hg-muted)] flex-shrink-0">
          {fmtTokens(view.tokens)}t
        </span>
      </div>
      <div
        className={
          (expanded
            ? "mt-2 px-2 py-1.5 bg-[var(--hg-bg)] border border-[var(--hg-line)] rounded-[2px] text-[var(--hg-ink-2)]"
            : "mt-0.5 text-[var(--hg-muted)] line-clamp-1") +
          " text-[11.5px] leading-[1.4]"
        }
      >
        {view.body}
      </div>
      {expanded && (
        <div className="mt-1.5 pt-1 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          {item.source === "fixed" && onUnpin && (
            <button onClick={onUnpin} className="hg-btn">
              ↓ unpin
            </button>
          )}
          {item.source === "soft" && onPin && (
            <button onClick={onPin} className="hg-btn">
              ↑ pin to fixed
            </button>
          )}
          {item.source === "soft" && <button className="hg-btn">summarize</button>}
          <span className="flex-1" />
          {item.source !== "task" && onDrop && (
            <button onClick={onDrop} className="hg-btn warn">
              drop ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function zoneStyles(source: RackItem["source"], _kind: string): string {
  if (source === "fixed") return "border-l-2 border-l-[var(--hg-accent)] ";
  if (source === "task")
    return "border-l-2 border-l-[var(--hg-accent-deep)] bg-[rgba(255,123,44,0.06)] ";
  return "border-l-2 border-l-transparent ";
}

interface View {
  kind: string;
  name: string;
  age?: string;
  tokens: number;
  body: string;
}

function resolveView(item: RackItem): View {
  if (item.source === "fixed") {
    const m = item.module;
    return { kind: m.kind, name: m.name, tokens: m.tokens, body: m.body };
  }
  if (item.source === "task") {
    const t = item.task;
    return { kind: "task", name: t.title, age: t.age, tokens: t.tokens, body: t.body };
  }
  const s = item.soft;
  if (s.kind === "turn") {
    return { kind: s.role, name: s.title, age: s.age, tokens: s.tokens, body: s.body };
  }
  return { kind: s.kind, name: s.title, age: s.age, tokens: s.tokens, body: s.body };
}

function KindChip({ kind, children }: { kind: string; children: ReactNode }) {
  const palette = chipPalette(kind);
  return (
    <span
      className="hg-mono text-[8.5px] tracking-wider uppercase px-1.5 py-[1px] rounded-[1px] flex-shrink-0"
      style={palette}
    >
      {children}
    </span>
  );
}

function chipPalette(kind: string): { background: string; color: string } {
  switch (kind) {
    case "summary":
      return { background: "var(--hg-accent-deep)", color: "var(--hg-bg)" };
    case "tool":
      return { background: "#6a7a8a", color: "var(--hg-bg)" };
    case "task":
      return { background: "var(--hg-accent)", color: "var(--hg-bg)" };
    case "user":
      return { background: "var(--hg-ink)", color: "var(--hg-bg)" };
    case "model":
      return { background: "var(--hg-ink-2)", color: "var(--hg-bg)" };
    case "doc":
      return { background: "#5a7a5a", color: "var(--hg-bg)" };
    case "rules":
      return { background: "#7a5a7a", color: "var(--hg-ink)" };
    case "log":
      return { background: "#8a6a3a", color: "var(--hg-bg)" };
    default:
      return { background: "var(--hg-ink-2)", color: "var(--hg-bg)" };
  }
}
