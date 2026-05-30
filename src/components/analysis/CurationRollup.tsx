"use client";

import { formatAnalysisTokens } from "@/lib/sessionAnalysis";
import type { CurationApi } from "@/lib/contextCuration";

/**
 * Compact "trim the request" summary. Lives at the top of the tree sidebar
 * when curate mode is on — shows kept vs. raw, a thin progress bar, the
 * dropped/summarized breakdown, and a reset action. The per-row pills live
 * on the tree itself; this is the global readout.
 */
export function CurationRollup({ curate }: { curate: CurationApi }) {
  const { rollup, reset } = curate;
  const pct = rollup.raw > 0 ? (rollup.kept / rollup.raw) * 100 : 100;

  return (
    <div className="border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
          trim
        </span>
        <button
          type="button"
          onClick={reset}
          disabled={rollup.delta === 0}
          className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)] hover:text-[var(--hg-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          reset
        </button>
      </div>
      <div className="mt-1 flex items-baseline justify-between font-mono text-[10.5px] tabular-nums">
        <span>
          <span className="text-[var(--hg-ink)]" style={{ fontWeight: 500 }}>
            {formatAnalysisTokens(rollup.kept)}
          </span>
          {rollup.delta > 0 && (
            <span className="ml-1 text-[var(--hg-muted)] line-through">
              {formatAnalysisTokens(rollup.raw)}
            </span>
          )}
          <span className="text-[var(--hg-muted)]"> tok</span>
        </span>
        <span className={rollup.delta > 0 ? "text-[var(--hg-accent)]" : "text-[var(--hg-muted)]"}>
          {rollup.delta > 0 ? `−${formatAnalysisTokens(rollup.delta)}` : `${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="mt-1 h-[2px] overflow-hidden bg-[var(--hg-bg-tint)]">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: rollup.delta > 0 ? "var(--hg-accent)" : "rgba(150,160,170,0.55)",
            opacity: 0.85,
          }}
        />
      </div>
      {(rollup.summarized > 0 || rollup.dropped > 0) && (
        <div className="mt-1 flex items-baseline gap-3 font-mono text-[9px] tabular-nums text-[var(--hg-muted)]">
          {rollup.summarized > 0 && <span>≈ {formatAnalysisTokens(rollup.summarized)}</span>}
          {rollup.dropped > 0 && <span>✕ {formatAnalysisTokens(rollup.dropped)}</span>}
        </div>
      )}
    </div>
  );
}
