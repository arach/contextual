// Left rail — Hudson's SidePanel populated with the thread list and a
// per-active footer summarizing load.
import type { MouseEvent } from "react";
import { SidePanel } from "hudsonkit/chrome";
import { Radio } from "lucide-react";
import type { Thread } from "@/types";
import { fmtTokens } from "@/lib/tokens";
import { ThreadItem } from "@/components/threads/ThreadItem";

interface ThreadsPanelProps {
  threads: Thread[];
  activeId: string;
  totalTokens: number;
  isCollapsed: boolean;
  width: number;
  onResizeStart: (e: MouseEvent) => void;
  onToggleCollapse: () => void;
  onSelect: (id: string) => void;
  onSelectBranch: (b: string) => void;
  onBranch: () => void;
}

export function ThreadsPanel({
  threads,
  activeId,
  totalTokens,
  isCollapsed,
  width,
  onResizeStart,
  onToggleCollapse,
  onSelect,
  onSelectBranch,
  onBranch,
}: ThreadsPanelProps) {
  const active = threads.find((t) => t.id === activeId);
  return (
    <SidePanel
      side="left"
      title="THREADS"
      icon={<Radio size={12} className="text-[var(--hg-accent)]" />}
      width={width}
      onResizeStart={onResizeStart}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      footer={
        active && (
          <div className="px-4 py-3 hg-mono text-[10px] text-[var(--hg-muted)] leading-[1.7] border-t border-[var(--hg-line)] bg-[var(--hg-bg)]">
            <Row k="active" v={`${active.id}/${active.activeBranch}`} />
            <Row k="turn" v={String(active.turn)} />
            <Row k="load" v={fmtTokens(totalTokens)} />
            <Row k="budget" v="100k" />
          </div>
        )
      }
    >
      <div className="px-2 pt-2 pb-3">
        {threads.map((t) => (
          <ThreadItem
            key={t.id}
            thread={t}
            isActive={t.id === activeId}
            onSelect={() => onSelect(t.id)}
            onSelectBranch={onSelectBranch}
            onBranch={onBranch}
          />
        ))}
        <button className="w-full mt-2 px-3 py-2 border border-dashed border-[var(--hg-hairline)] rounded-[2px] hg-mono text-[10.5px] tracking-wider uppercase text-[var(--hg-muted)] hover:text-[var(--hg-accent)] hover:border-[var(--hg-accent)]">
          + new thread
        </button>
      </div>
    </SidePanel>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span>
      <b className="text-[var(--hg-ink)] font-medium">{v}</b>
    </div>
  );
}
