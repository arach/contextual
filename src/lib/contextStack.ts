import {
  type SessionAnalysis,
  type ThresholdSnapshot,
} from "@/lib/sessionAnalysis";
import { atomsInWindowOrder } from "@/lib/sessionWindow";
import type {
  AtRestLine,
  ExploreContextMode,
  ManifestPart,
  ManifestPartKind,
  ManifestTruth,
  TurnReadyManifest,
} from "@/lib/harnessContract";
import {
  atRestNodeId,
  turnReadyPartNodeId,
} from "@/lib/harnessExplore";

/**
 * Shared model for the "request as a stack of layers" view. TokenStack and the
 * sidebar As-of panel both consume this — keeps a single source of truth for
 * what a layer is in each mode.
 */

export type LayerKind =
  | "system"
  | "tools"
  | "user"
  | "assistant"
  | "tool-call"
  | "tool-result"
  | "reasoning"
  | "developer"
  | "sidecar"
  | "attachment"
  | "memory"
  | "workspace"
  | "compact-summary"
  | "atom"
  | "line"
  | "other";

export interface StackLayer {
  id: string;
  nodeId: string;
  label: string;
  sub?: string;
  tokens: number;
  kind: LayerKind;
  truth?: ManifestTruth;
}

export const LAYER_KIND_COLOR: Record<LayerKind, string> = {
  system: "#94a3b8",
  developer: "#94a3b8",
  tools: "#9ca3af",
  user: "#4ade80",
  assistant: "#bfa3e5",
  reasoning: "#bfa3e5",
  "tool-call": "#fcb86c",
  "tool-result": "#9ca3af",
  sidecar: "#94a3b8",
  attachment: "#94a3b8",
  memory: "#94a3b8",
  workspace: "#94a3b8",
  "compact-summary": "#bfa3e5",
  atom: "#9ca3af",
  line: "#9ca3af",
  other: "#9ca3af",
};

export interface BuildLayersInput {
  mode: ExploreContextMode;
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  manifest?: TurnReadyManifest | null;
  atRest?: { lines: AtRestLine[]; totalLines: number } | null;
}

export function buildStackLayers(input: BuildLayersInput): StackLayer[] {
  const { mode, session, snapshot, manifest, atRest } = input;
  if (mode === "turn-ready") return manifest ? layersFromManifest(manifest) : [];
  if (mode === "at-rest") return atRest ? layersFromAtRest(atRest.lines) : [];
  return layersFromContextual(session, snapshot);
}

export function findLayerByNodeId(layers: StackLayer[], nodeId: string): {
  index: number;
  layer: StackLayer | null;
  cumulative: number;
  total: number;
} {
  let cumulative = 0;
  let total = 0;
  let index = -1;
  let layer: StackLayer | null = null;
  for (let i = 0; i < layers.length; i++) {
    total += layers[i].tokens;
    if (layers[i].nodeId === nodeId) {
      index = i;
      layer = layers[i];
    }
  }
  if (index >= 0) {
    cumulative = layers.slice(0, index + 1).reduce((s, l) => s + l.tokens, 0);
  }
  return { index, layer, cumulative, total };
}

function layersFromManifest(manifest: TurnReadyManifest): StackLayer[] {
  return manifest.parts.map((part) => ({
    id: `mp:${part.order}`,
    nodeId: turnReadyPartNodeId(part.order),
    label: partLabel(part),
    sub: subForPart(part),
    tokens: part.tokens ?? 0,
    kind: partKindToLayerKind(part.kind),
    truth: part.truth,
  }));
}

function partLabel(part: ManifestPart): string {
  const ord = String(part.order).padStart(2, "0");
  return `${ord} · ${part.title ?? part.kind}`;
}

function subForPart(part: ManifestPart): string | undefined {
  const bits: string[] = [];
  if (part.role) bits.push(part.role);
  if (part.transfer && part.transfer !== "direct") bits.push(part.transfer);
  return bits.length ? bits.join(" · ") : undefined;
}

function partKindToLayerKind(kind: ManifestPartKind): LayerKind {
  switch (kind) {
    case "system":
    case "developer":
    case "user":
    case "assistant":
    case "tool-call":
    case "tool-result":
    case "reasoning":
    case "sidecar":
    case "attachment":
    case "memory":
    case "workspace":
    case "compact-summary":
      return kind;
    default:
      return "other";
  }
}

function layersFromAtRest(lines: AtRestLine[]): StackLayer[] {
  return lines.map((line) => ({
    id: `arl:${line.line}`,
    nodeId: atRestNodeId(line.line),
    label: `${String(line.line).padStart(3, "0")} · ${line.recordType}`,
    sub: line.role ?? undefined,
    // at-rest lines don't carry token counts in the contract; weight equally
    // so the bar acts as a sequence marker rather than a meter.
    tokens: 1,
    kind: lineToLayerKind(line),
  }));
}

function lineToLayerKind(line: AtRestLine): LayerKind {
  if (line.role === "system" || line.role === "developer") return "system";
  if (line.role === "user") return "user";
  if (line.role === "assistant") return "assistant";
  if (line.role === "tool") return "tool-result";
  return "line";
}

function layersFromContextual(
  session: SessionAnalysis,
  snapshot: ThresholdSnapshot,
): StackLayer[] {
  const ordered = atomsInWindowOrder(session, snapshot);
  return ordered.slice(0, 400).map((atom) => ({
    id: `at:${atom.id}`,
    nodeId: `atom:${atom.id}`,
    label: shortAtomLabel(atom.label),
    sub: atom.role ? `${atom.bucket} · ${atom.role}` : atom.bucket,
    tokens: atom.tokens,
    kind: atomToLayerKind(atom.sourceType, atom.role),
  }));
}

function shortAtomLabel(label: string): string {
  if (label.length <= 38) return label;
  return label.slice(0, 36) + "…";
}

function atomToLayerKind(
  sourceType: "message" | "tool-call" | "tool-output" | "reasoning" | "media" | "missing",
  role: string | null,
): LayerKind {
  if (sourceType === "tool-call") return "tool-call";
  if (sourceType === "tool-output") return "tool-result";
  if (sourceType === "reasoning") return "reasoning";
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "system" || role === "developer") return "system";
  return "atom";
}
