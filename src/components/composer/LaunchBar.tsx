// The "fuel bar" above the composer — three stacked segments representing
// Fixed / Soft / Draft consumption of the 100k budget. Communicates over-
// budget state by going red.
import { fmtTokens } from "@/lib/tokens";
import { TOTAL_BUDGET } from "@/types";

interface LaunchBarProps {
  fixedTokens: number;
  softTokens: number;
  draftTokens: number;
}

export function LaunchBar({ fixedTokens, softTokens, draftTokens }: LaunchBarProps) {
  const callTokens = fixedTokens + softTokens + draftTokens;
  const overBudget = callTokens > TOTAL_BUDGET;
  const fixW = pct(fixedTokens);
  const sftW = pct(softTokens);
  const dftW = pct(draftTokens);

  return (
    <div className="flex items-center gap-3.5 mb-2 hg-mono text-[10.5px] text-[var(--hg-muted)] tracking-wider uppercase">
      <span>next call ·</span>
      <div
        className="flex-1 max-w-[420px] h-[5px] rounded-[2px] overflow-hidden bg-[var(--hg-bg-tint)] border border-[var(--hg-line)] flex"
      >
        <div className="bg-[var(--hg-ink)]" style={{ width: fixW + "%" }} />
        <div className="bg-[var(--hg-accent)]" style={{ width: sftW + "%" }} />
        <div className="bg-[var(--hg-accent-deep)]" style={{ width: dftW + "%" }} />
      </div>
      <span>
        <b className="text-[var(--hg-ink)] font-medium">{fmtTokens(callTokens)}</b> / 100k
      </span>
      <span className={overBudget ? "text-[var(--hg-warn)]" : ""}>
        {overBudget ? "over budget · prune to dispatch" : `${fmtTokens(TOTAL_BUDGET - callTokens)} free`}
      </span>
    </div>
  );
}

function pct(t: number): number {
  return (t / TOTAL_BUDGET) * 100;
}
