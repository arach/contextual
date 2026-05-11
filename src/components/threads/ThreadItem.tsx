// A single thread row. When active it shows branches and gets corner-bracket
// reticles — the Hangar tell for "this is the locked target."
import type { Thread } from "@/types";
import { BranchPills } from "@/components/threads/BranchPills";
import { VuMeter } from "@/components/threads/VuMeter";

interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
  onSelectBranch: (b: string) => void;
  onBranch: () => void;
}

const STATUS_LIT: Record<Thread["status"], number> = {
  live: 8,
  idle: 4,
  archived: 2,
};

export function ThreadItem({
  thread,
  isActive,
  onSelect,
  onSelectBranch,
  onBranch,
}: ThreadItemProps) {
  const live = thread.status === "live";
  return (
    <div
      onClick={onSelect}
      className={
        "px-3 py-2 mb-1 rounded-[2px] cursor-pointer border " +
        (isActive
          ? "hg-reticle border-[var(--hg-accent)] bg-[rgba(255,123,44,0.08)]"
          : "border-transparent hover:bg-[var(--hg-bg-tint)]")
      }
    >
      <div className="flex items-start gap-2.5">
        <span
          className={
            "w-[7px] h-[7px] rounded-full mt-1.5 flex-shrink-0 " +
            (live
              ? "bg-[var(--hg-accent)] shadow-[0_0_8px_var(--hg-accent)]"
              : "bg-[var(--hg-muted)]")
          }
        />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[var(--hg-ink)]">{thread.name}</div>
          <div className="hg-mono text-[10px] text-[var(--hg-muted)] mt-[2px]">
            {thread.status} · turn {thread.turn} · {thread.lastActive}
          </div>
          <VuMeter lit={STATUS_LIT[thread.status]} />
          {isActive && (
            <BranchPills
              branches={thread.branches}
              activeBranch={thread.activeBranch}
              onSelect={onSelectBranch}
              onBranch={onBranch}
            />
          )}
        </div>
      </div>
    </div>
  );
}
