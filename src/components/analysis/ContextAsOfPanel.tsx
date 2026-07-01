"use client";

import { useMemo } from "react";

import {
  formatAnalysisTokens,
  type SessionAnalysis,
  type ThresholdSnapshot,
} from "@/lib/sessionAnalysis";
import type {
  AtRestLine,
  ExploreContextMode,
  TurnReadyManifest,
} from "@/lib/harnessContract";
import {
  LAYER_KIND_COLOR,
  buildStackLayers,
  findLayerByNodeId,
} from "@/lib/contextStack";

/**
 * Compact "as of" readout for the currently selected layer. Lives sticky at
 * the bottom of the sidebar — minimap-style: always visible regardless of
 * tree scroll or whether the right rail is shown. Mode-aware: derives its
 * layer list from the same shared `buildStackLayers` the rail uses, so the
 * two stay in sync.
 */
export interface ContextAsOfPanelProps {
  mode: ExploreContextMode;
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  manifest?: TurnReadyManifest | null;
  atRest?: { lines: AtRestLine[]; totalLines: number } | null;
  selectedNodeId: string;
}

export function ContextAsOfPanel({
  mode,
  session,
  snapshot,
  manifest,
  atRest,
  selectedNodeId,
}: ContextAsOfPanelProps) {
  const { layer, cumulative, total } = useMemo(() => {
    const layers = buildStackLayers({ mode, session, snapshot, manifest, atRest });
    return findLayerByNodeId(layers, selectedNodeId);
  }, [mode, session, snapshot, manifest, atRest, selectedNodeId]);

  if (!layer) {
    return (
      <div className="border-t border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-3 py-2">
        <div className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
          as of
        </div>
        <p className="mt-1 font-mono text-[10px] leading-snug text-[var(--hg-muted)]">
          Pick a layer to see cumulative tokens and its info.
        </p>
      </div>
    );
  }

  const pct = total > 0 ? (cumulative / total) * 100 : 0;
  const isLineMode = mode === "at-rest";

  return (
    <div className="border-t border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-3 py-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="hg-mono truncate text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
          as of
        </span>
        <span
          className="shrink-0 hg-mono text-[9px] uppercase tracking-wider"
          style={{ color: LAYER_KIND_COLOR[layer.kind] }}
        >
          {layer.kind}
        </span>
      </div>
      <div className="truncate font-mono text-[10.5px] text-[var(--hg-ink)]" title={layer.label}>
        {layer.label}
      </div>
      {layer.sub && (
        <div className="mt-0.5 truncate font-mono text-[9px] text-[var(--hg-muted)]">
          {layer.sub}
        </div>
      )}

      <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] tabular-nums">
        <span className="text-[var(--hg-muted)]">cumulative</span>
        <span className="text-[var(--hg-ink)]" style={{ fontWeight: 500 }}>
          {isLineMode ? `${cumulative} / ${total}` : formatAnalysisTokens(cumulative)}
        </span>
      </div>
      <div className="mt-1 h-[2px] overflow-hidden bg-[var(--hg-bg-tint)]">
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: "var(--hg-accent)", opacity: 0.85 }}
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between font-mono text-[9px] tabular-nums text-[var(--hg-muted)]">
        <span>{pct.toFixed(0)}% of stack</span>
        {!isLineMode && <span>{formatAnalysisTokens(layer.tokens)} tok</span>}
        {layer.truth && (
          <span style={{ color: layer.truth === "logged" ? "var(--hg-accent)" : undefined }}>
            {layer.truth}
          </span>
        )}
      </div>
    </div>
  );
}
