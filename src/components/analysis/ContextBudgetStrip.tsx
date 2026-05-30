"use client";

import { useMemo } from "react";

import { formatAnalysisTokens, type SessionAnalysis, type ThresholdSnapshot } from "@/lib/sessionAnalysis";
import type { ExploreContextMode, TurnReadyManifest, ManifestPart } from "@/lib/harnessContract";

/**
 * Mode-aware budget strip. A single-line readout + a hairline proportional bar.
 *
 * - Contextual: coverage of the threshold window, bar segmented by bucket allocation
 * - Turn-ready: estimated input tokens vs. model window, bar segmented by part kind
 * - At-rest:    lines loaded vs. total (no token budget — record count instead)
 *
 * Modular by design: this component owns no state. Inputs in, JSX out.
 */
export interface ContextBudgetStripProps {
  mode: ExploreContextMode;
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  manifest?: TurnReadyManifest | null;
  atRest?: { loadedLines: number; totalLines: number } | null;
  curatedTokens?: number | null;
}

interface BarSegment {
  key: string;
  label: string;
  tokens: number;
  pct: number;
  color: string;
}

const KIND_COLOR: Record<string, string> = {
  system: "rgba(180,200,210,0.55)",
  developer: "rgba(180,200,210,0.40)",
  tools: "rgba(140,160,180,0.45)",
  user: "rgba(74,222,128,0.55)",
  assistant: "rgba(190,170,230,0.55)",
  "tool-call": "rgba(252,184,108,0.55)",
  "tool-result": "rgba(140,160,180,0.55)",
  reasoning: "rgba(190,170,230,0.35)",
  other: "rgba(150,160,170,0.30)",
};

const BUCKET_TINT: Record<string, string> = {
  task: "rgba(196,111,58,0.65)",
  codebase: "rgba(185,193,200,0.55)",
  tools: "rgba(130,141,150,0.55)",
  environment: "rgba(116,137,145,0.55)",
  verification: "rgba(155,141,104,0.55)",
  decisions: "rgba(155,120,120,0.55)",
  collaboration: "rgba(116,141,138,0.55)",
  policy: "rgba(110,119,128,0.55)",
  history: "rgba(75,84,92,0.65)",
  media: "rgba(136,125,141,0.55)",
};

export function ContextBudgetStrip({
  mode,
  session,
  snapshot,
  manifest,
  atRest,
  curatedTokens,
}: ContextBudgetStripProps) {
  const data = useMemo(() => {
    if (mode === "contextual") return buildContextual(session, snapshot, curatedTokens ?? null);
    if (mode === "turn-ready") return buildTurnReady(manifest ?? null);
    return buildAtRest(atRest);
  }, [mode, session, snapshot, manifest, atRest, curatedTokens]);

  if (!data) return null;

  return (
    <div className="flex shrink-0 flex-col gap-1 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-3 py-1.5">
      <div className="flex items-baseline justify-between gap-3 font-mono text-[10px] text-[var(--hg-muted)] tabular-nums">
        <span className="truncate">
          <span className="text-[var(--hg-ink)]">{data.primaryValue}</span>
          {data.primaryDenom && <span className="text-[var(--hg-muted)]"> / {data.primaryDenom}</span>}
          <span className="text-[var(--hg-muted)]"> {data.primaryUnit}</span>
          {data.curatedNote && (
            <span className="ml-3 text-[var(--hg-accent)]">{data.curatedNote}</span>
          )}
        </span>
        <span className={data.pctTone}>{data.pctText}</span>
      </div>
      {data.segments.length > 0 && (
        <div className="flex h-[3px] overflow-hidden bg-[var(--hg-bg-tint)]">
          {data.segments.map((seg) => (
            <div
              key={seg.key}
              style={{ width: `${seg.pct}%`, background: seg.color }}
              title={`${seg.label} · ${formatAnalysisTokens(seg.tokens)}`}
            />
          ))}
        </div>
      )}
      {data.tertiary && (
        <div className="font-mono text-[9px] text-[var(--hg-muted)] tabular-nums truncate">
          {data.tertiary}
        </div>
      )}
    </div>
  );
}

interface StripData {
  primaryValue: string;
  primaryDenom?: string;
  primaryUnit: string;
  pctText: string;
  pctTone: string;
  curatedNote?: string;
  segments: BarSegment[];
  tertiary?: string;
}

function buildContextual(
  session: SessionAnalysis,
  snapshot: ThresholdSnapshot,
  curatedTokens: number | null,
): StripData {
  const covered = snapshot.coveredTokens;
  const budget = snapshot.threshold || session.engineBudget;
  const allocations = snapshot.allocations.filter((a) => a.tokens > 0);
  const segments: BarSegment[] = allocations.map((a) => ({
    key: a.bucket,
    label: a.bucket,
    tokens: a.tokens,
    pct: (a.tokens / budget) * 100,
    color: BUCKET_TINT[a.bucket] ?? "rgba(150,160,170,0.4)",
  }));

  const pct = (covered / budget) * 100;
  const effective = curatedTokens != null ? curatedTokens : covered;
  const delta = curatedTokens != null ? covered - curatedTokens : 0;

  return {
    primaryValue: formatAnalysisTokens(effective),
    primaryDenom: formatAnalysisTokens(budget),
    primaryUnit: "tok",
    pctText: `${pct.toFixed(1)}%`,
    pctTone: pct > 80 ? "text-[var(--hg-warn)]" : "text-[var(--hg-muted)]",
    curatedNote: delta > 0 ? `−${formatAnalysisTokens(delta)} curated` : undefined,
    segments,
    tertiary: `pinned ${formatAnalysisTokens(snapshot.pinnedTokens)} · tail ${formatAnalysisTokens(
      snapshot.tailTokens,
    )} · ${snapshot.strategy}`,
  };
}

function buildTurnReady(manifest: TurnReadyManifest | null): StripData | null {
  if (!manifest) return null;
  const est = manifest.tokenBudget.estimatedInputTokens ?? sumPartTokens(manifest.parts);
  const window = manifest.tokenBudget.modelWindow ?? null;

  const byKind = new Map<string, number>();
  for (const part of manifest.parts) {
    if (!part.tokens) continue;
    byKind.set(part.kind, (byKind.get(part.kind) ?? 0) + part.tokens);
  }
  const total = Math.max(est, 1);
  const segments: BarSegment[] = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, tokens]) => ({
      key: kind,
      label: kind,
      tokens,
      pct: window ? (tokens / window) * 100 : (tokens / total) * 100,
      color: KIND_COLOR[kind] ?? KIND_COLOR.other,
    }));

  const pct = window ? (est / window) * 100 : null;
  return {
    primaryValue: formatAnalysisTokens(est),
    primaryDenom: window ? formatAnalysisTokens(window) : undefined,
    primaryUnit: window ? "tok" : "est tok",
    pctText: pct != null ? `${pct.toFixed(1)}%` : `${manifest.parts.length} parts`,
    pctTone: pct != null && pct > 80 ? "text-[var(--hg-warn)]" : "text-[var(--hg-muted)]",
    segments,
    tertiary: manifest.model
      ? `model ${manifest.model} · ${manifest.assembly.status} · ${manifest.assembly.confidence}`
      : `${manifest.assembly.status} · ${manifest.assembly.confidence}`,
  };
}

function buildAtRest(
  atRest: { loadedLines: number; totalLines: number } | null | undefined,
): StripData | null {
  if (!atRest) return null;
  const { loadedLines, totalLines } = atRest;
  const pct = totalLines ? (loadedLines / totalLines) * 100 : 0;
  return {
    primaryValue: String(loadedLines),
    primaryDenom: String(totalLines || "…"),
    primaryUnit: "lines",
    pctText: totalLines ? `${pct.toFixed(0)}%` : "—",
    pctTone: "text-[var(--hg-muted)]",
    segments:
      totalLines > 0
        ? [
            {
              key: "loaded",
              label: "loaded",
              tokens: loadedLines,
              pct,
              color: "rgba(74,222,128,0.5)",
            },
          ]
        : [],
    tertiary: "at-rest jsonl · native records on disk",
  };
}

function sumPartTokens(parts: ManifestPart[]): number {
  return parts.reduce((s, p) => s + (p.tokens ?? 0), 0);
}
