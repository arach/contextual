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
    <div className="mt-1.5 flex flex-wrap gap-1" onClick={stop}>
      {branches.map((b) => (
        <button
          key={b}
          type="button"
          onClick={(e) => {
            stop(e);
            onSelect(b);
          }}
          className={
            "text-[11px] px-1.5 py-0.5 rounded border " +
            (b === activeBranch
              ? "bg-[var(--ctx-accent-tint)] text-[var(--ctx-ink-2)] border-[var(--ctx-accent-line)]"
              : "bg-transparent text-neutral-600 border-transparent hover:text-neutral-400")
          }
        >
          {b}
        </button>
      ))}
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          onBranch();
        }}
        className="text-[11px] px-1.5 py-0.5 text-neutral-600 hover:text-neutral-400"
      >
        + branch
      </button>
    </div>
  );
}
