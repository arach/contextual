// Small per-thread cost telemetry chip. Shown in the rack header when the
// thread's most recent dispatch was through pi-ai (which returns a normalized
// usage struct). Hidden for pi-coding-agent dispatches.

import { useState } from "react";
import type { LastUsage } from "@/types";

interface CostChipProps {
  usage: LastUsage;
}

function fmtUsd(n: number): string {
  if (n < 0.0001) return "<$0.0001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function fmtTok(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

export function CostChip({ usage }: CostChipProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hg-pill cursor-pointer flex items-center gap-1.5 transition-colors"
        title="last dispatch usage"
      >
        <span className="w-[5px] h-[5px] rounded-full bg-neutral-500" />
        {fmtUsd(usage.costUsd)}
        {usage.cacheRead > 0 && (
          <span className="text-[var(--hg-muted)]">· cache {fmtTok(usage.cacheRead)}</span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[240px] bg-[var(--hg-surface)] border border-[var(--hg-line)] rounded-[2px] shadow-[0_12px_30px_-16px_rgba(0,0,0,0.7)] p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hg-mono text-[9.5px] tracking-wider uppercase text-[var(--hg-muted)] mb-2">
            last dispatch
          </div>
          <Row label="cost" value={fmtUsd(usage.costUsd)} />
          <Row label="input" value={`${fmtTok(usage.input)} tok`} />
          <Row label="output" value={`${fmtTok(usage.output)} tok`} />
          <Row label="cache read" value={`${fmtTok(usage.cacheRead)} tok`} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-dotted border-[var(--hg-hairline)] last:border-b-0 hg-mono text-[10.5px]">
      <span className="text-[var(--hg-muted)]">{label}</span>
      <span className="text-[var(--hg-ink)]">{value}</span>
    </div>
  );
}
