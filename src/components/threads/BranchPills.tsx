// Branches as terse mono pills. The "+ branch" pill triggers a fork action.
import type { MouseEvent } from "react";

interface BranchPillsProps {
  branches: string[];
  activeBranch: string;
  onSelect: (b: string) => void;
  onBranch: () => void;
}

export function BranchPills({ branches, activeBranch, onSelect, onBranch }: BranchPillsProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <div className="mt-2 flex flex-wrap gap-1" onClick={stop}>
      {branches.map((b) => (
        <button
          key={b}
          onClick={(e) => {
            stop(e);
            onSelect(b);
          }}
          className={
            "hg-mono text-[9.5px] tracking-wider px-1.5 py-[1px] rounded-[2px] border " +
            (b === activeBranch
              ? "bg-[var(--hg-accent)] text-[var(--hg-bg)] border-[var(--hg-accent)]"
              : "bg-[var(--hg-bg-tint)] text-[var(--hg-ink-2)] border-transparent hover:border-[var(--hg-line)]")
          }
        >
          {b}
        </button>
      ))}
      <button
        onClick={(e) => {
          stop(e);
          onBranch();
        }}
        className="hg-mono text-[9.5px] tracking-wider px-1.5 py-[1px] rounded-[2px] border border-dashed border-[var(--hg-hairline)] text-[var(--hg-muted)] hover:text-[var(--hg-accent)] hover:border-[var(--hg-accent)]"
      >
        + branch
      </button>
    </div>
  );
}
