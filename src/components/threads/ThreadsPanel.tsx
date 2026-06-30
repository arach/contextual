import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { SidePanel } from "hudsonkit/chrome";
import { HudRail } from "hudsonkit/patterns";
import type { HudRailItem, HudRailSection } from "hudsonkit/patterns";
import { Radio } from "lucide-react";
import type { Thread } from "@/types";
import { BranchPills } from "@/components/threads/BranchPills";

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

export function ThreadsPanelContent({
  threads,
  activeId,
  onSelect,
  onSelectBranch,
  onBranch,
}: {
  threads: Thread[];
  activeId: string;
  onSelect: (id: string) => void;
  onSelectBranch: (b: string) => void;
  /** Omitted when the Fork flag is off — hides the branch affordance. */
  onBranch?: () => void;
}) {
  const [query, setQuery] = useState("");
  const railSections = useMemo(
    () => buildRailSections(threads, activeId, query, onSelectBranch, onBranch),
    [threads, activeId, query, onSelectBranch, onBranch],
  );

  return (
    <HudRail
      sections={railSections}
      selectedId={activeId}
      onSelect={(item) => onSelect(item.id)}
      search={{
        value: query,
        onChange: setQuery,
        placeholder: "Filter…",
      }}
      actions={
        <button className="hg-btn ghost text-[11px]" type="button">
          New
        </button>
      }
      density="compact"
      className="h-full border-r-0 bg-transparent"
      empty="No threads match."
    />
  );
}

export function ThreadsPanel({
  threads,
  activeId,
  totalTokens: _totalTokens,
  isCollapsed,
  width,
  onResizeStart,
  onToggleCollapse,
  onSelect,
  onSelectBranch,
  onBranch,
}: ThreadsPanelProps) {
  return (
    <SidePanel
      side="left"
      title="Threads"
      icon={<Radio size={12} className="text-neutral-500" />}
      width={width}
      onResizeStart={onResizeStart}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
    >
      <ThreadsPanelContent
        threads={threads}
        activeId={activeId}
        onSelect={onSelect}
        onSelectBranch={onSelectBranch}
        onBranch={onBranch}
      />
    </SidePanel>
  );
}

function buildRailSections(
  threads: Thread[],
  activeId: string,
  query: string,
  onSelectBranch: (b: string) => void,
  onBranch?: () => void,
): HudRailSection[] {
  const q = query.trim().toLowerCase();
  const visible = q
    ? threads.filter((t) =>
        [t.id, t.name, t.activeBranch, t.status, ...t.branches]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : threads;

  const toItem = (thread: Thread): HudRailItem => {
    const isActive = thread.id === activeId;
    return {
      id: thread.id,
      title: thread.name,
      subtitle: isActive ? (
        <BranchPills
          branches={thread.branches}
          activeBranch={thread.activeBranch}
          onSelect={onSelectBranch}
          onBranch={onBranch}
        />
      ) : (
        <span className="text-[11px] text-neutral-600">{thread.lastActive}</span>
      ),
      avatar: (
        <span
          className={
            "mt-1.5 block h-1.5 w-1.5 rounded-full " +
            (thread.status === "live" ? "bg-[var(--ctx-accent)]" : "bg-neutral-700")
          }
        />
      ),
      status: thread.status,
      statusTone:
        thread.status === "live" ? "accent" : thread.status === "idle" ? "neutral" : "warning",
    };
  };

  const open = visible.filter((t) => t.status !== "archived").map(toItem);
  const archived = visible.filter((t) => t.status === "archived").map(toItem);

  return [
    {
      id: "open-contexts",
      title: "Open",
      count: open.length,
      items: open,
    },
    {
      id: "archived-contexts",
      title: "Archive",
      count: archived.length,
      items: archived,
      empty: "No archived threads.",
    },
  ];
}
