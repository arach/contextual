// A condensed bar showing fixed vs soft segments against the 100k budget.
// Sits below the gauges in the rack header.
import { fmtTokens } from "@/lib/tokens";
import { TOTAL_BUDGET } from "@/types";

interface FuelBarProps {
  fixedTokens: number;
  softTokens: number;
}

export function FuelBar({ fixedTokens, softTokens }: FuelBarProps) {
  const fixW = (fixedTokens / TOTAL_BUDGET) * 100;
  const sftW = (softTokens / TOTAL_BUDGET) * 100;
  const free = Math.max(0, TOTAL_BUDGET - fixedTokens - softTokens);
  return (
    <>
      <div className="mt-2.5 h-[7px] rounded-[2px] overflow-hidden bg-[var(--hg-bg-tint)] border border-[var(--hg-line)] flex">
        <div className="bg-[var(--hg-ink)]" style={{ width: fixW + "%" }} />
        <div className="bg-[var(--hg-accent)]" style={{ width: sftW + "%" }} />
      </div>
      <div className="mt-1.5 flex gap-3 hg-mono text-[10px] text-[var(--hg-muted)] tracking-wider uppercase">
        <span>
          <Swatch color="var(--hg-ink)" /> fix <b className="text-[var(--hg-ink)] font-medium">{fmtTokens(fixedTokens)}</b>
        </span>
        <span>
          <Swatch color="var(--hg-accent)" /> soft <b className="text-[var(--hg-ink)] font-medium">{fmtTokens(softTokens)}</b>
        </span>
        <span className="ml-auto">
          free <b className="text-[var(--hg-ink)] font-medium">{fmtTokens(free)}</b>
        </span>
      </div>
    </>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-[2px] mr-1.5 align-[1px]"
      style={{ background: color }}
    />
  );
}
