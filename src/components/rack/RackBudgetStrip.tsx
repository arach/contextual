import { useState } from "react";
import { fmtTokens } from "@/lib/tokens";
import { TOTAL_BUDGET } from "@/types";

interface RackBudgetStripProps {
  fixedTokens: number;
  softTokens: number;
  fixedBudgetTokens: number;
  softBudgetTokens: number;
}

export function RackBudgetStrip({
  fixedTokens,
  softTokens,
  fixedBudgetTokens,
  softBudgetTokens,
}: RackBudgetStripProps) {
  const [expanded, setExpanded] = useState(false);
  const total = fixedTokens + softTokens;
  const free = Math.max(0, TOTAL_BUDGET - total);
  const fixW = (fixedTokens / TOTAL_BUDGET) * 100;
  const sftW = (softTokens / TOTAL_BUDGET) * 100;
  const over = total > TOTAL_BUDGET;

  return (
    <div className="px-4 py-2.5 border-b border-[var(--hg-line)]">
      <button
        type="button"
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 h-1 rounded-sm overflow-hidden bg-[var(--ctx-bg-tint)] flex min-w-0">
          <div
            className="bg-[var(--ctx-accent-deep)]/90"
            style={{ width: `${fixW}%` }}
          />
          <div className="bg-[var(--ctx-accent)]/55" style={{ width: `${sftW}%` }} />
        </div>
        <span
          className={
            "shrink-0 font-mono text-[10px] tabular-nums " +
            (over ? "text-[var(--ctx-warn)]" : "text-neutral-500")
          }
        >
          {fmtTokens(total)} / 100k
        </span>
        <span className="text-neutral-600 text-[10px]">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="mt-2 grid grid-cols-3 gap-3 font-mono text-[10px] text-neutral-500">
          <div>
            <span className="text-neutral-600">Fixed</span>{" "}
            <span className="text-neutral-400">
              {fmtTokens(fixedTokens)} / {fmtTokens(fixedBudgetTokens)}
            </span>
          </div>
          <div>
            <span className="text-neutral-600">Soft</span>{" "}
            <span className="text-neutral-400">
              {fmtTokens(softTokens)} / {fmtTokens(softBudgetTokens)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-neutral-600">{fmtTokens(free)} free</span>
          </div>
        </div>
      )}
    </div>
  );
}
