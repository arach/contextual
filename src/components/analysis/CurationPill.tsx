"use client";

import type { KeyboardEvent, MouseEvent } from "react";

import {
  CURATION_LABEL,
  CURATION_SYMBOL,
  type CurationApi,
  type CurationState,
} from "@/lib/contextCuration";

/**
 * Small inline pill for cycling a node's curation state (keep → summarize →
 * drop → keep). Rendered as a role="button" span (not a <button>) because it
 * lives inside the clickable tree-row button — nested <button>s are invalid HTML
 * and break hydration. Stops propagation so it doesn't also fire the row onClick.
 */
export function CurationPill({
  state,
  onCycle,
  size = "sm",
}: {
  state: CurationState;
  onCycle: () => void;
  size?: "sm" | "xs";
}) {
  const tone =
    state === "drop"
      ? "border-[var(--hg-warn)]/40 text-[var(--hg-warn)]"
      : state === "summarize"
        ? "border-[var(--hg-accent)]/40 text-[var(--hg-accent)]"
        : "border-[var(--hg-line)] text-[var(--hg-muted)]";

  const padding = size === "xs" ? "px-1 py-0" : "px-1.5 py-[1px]";
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";

  const fire = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
    event.preventDefault();
    onCycle();
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={fire}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") fire(event);
      }}
      title={`curation: ${CURATION_LABEL[state]} (click to cycle)`}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[2px] border ${padding} font-mono ${text} leading-none transition-colors hover:bg-[var(--hg-bg-tint)] ${tone}`}
    >
      {CURATION_SYMBOL[state]}
    </span>
  );
}

/**
 * Topbar toggle to turn curate mode on/off.
 */
export function CurateModeToggle({ curate }: { curate: CurationApi }) {
  const { enabled, setEnabled, rollup } = curate;
  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      title="Toggle curate mode (click rows to mark keep / summarize / drop)"
      className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 hg-mono text-[9px] uppercase tracking-wider transition-colors ${
        enabled
          ? "border-[var(--hg-accent)]/50 bg-[var(--hg-accent-tint)] text-[var(--hg-ink)]"
          : "border-[var(--hg-line)] text-[var(--hg-muted)] hover:text-[var(--hg-ink)]"
      }`}
    >
      <span>curate</span>
      {enabled && rollup.delta > 0 && (
        <span className="text-[var(--hg-accent)] tabular-nums">
          −{formatCompact(rollup.delta)}
        </span>
      )}
    </button>
  );
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
