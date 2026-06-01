export type CartridgeLifecycle = "draft" | "review" | "published" | "archived";
export type TruthState = "logged" | "reconstructed" | "inferred" | "manual";
export type FreshnessStability = "durable" | "session-local" | "stale-prone";
export type SourceState = "fresh" | "review" | "stale" | "missing";
export type LaunchTargetHarness = "codex" | "claude" | "opencode" | "pi" | "pi-ai";
export type CompatibilityState = "native" | "compatible" | "transform-required" | "unsupported";
export type LoadProfileId = "briefing" | "working-set" | "deep-pack";
export type EvalResult = "pass" | "warn" | "fail";
export type HealthTone = "ok" | "info" | "warn" | "error" | "neutral";
export type HealthRecommendation = "keep" | "refresh" | "rebuild" | "block-launch";
export type PlannerStageStatus = "untouched" | "drafting" | "proposed" | "accepted";
export type PlannerDecisionKind = "accept" | "omit" | "defer" | "edit";
export type PlanStatus = "ready" | "warnings" | "blocked";
export type LineageKind = "native-fork" | "replay-fork" | "recipe-derived" | "manual-fork";

export interface CartridgeScope {
  kind: "repo" | "directory" | "global";
  path: string;
  branchHint?: string;
}

export interface LaunchTarget {
  harness: LaunchTargetHarness;
  label: string;
  model?: string;
  provider?: string;
  cwd?: string;
  compatibility: CompatibilityState;
  reason: string;
}

export interface CartridgeSource {
  id: string;
  name: string;
  family: "session" | "doc" | "reconstruction" | "manual" | "code" | "sidecar";
  path: string;
  observedAt: string;
  truth: TruthState;
  coverage: string;
  state: SourceState;
  covers: string;
  exploreHref?: string;
}

export interface CartridgeProvenance {
  sourceId: string;
  contentHash: string;
  observedAt: string;
  truth: TruthState;
  note: string;
}

export interface CartridgePart {
  id: string;
  order: number;
  kind:
    | "task-brief"
    | "repo-map"
    | "decision-ledger"
    | "source-digest"
    | "harness-semantics"
    | "eval-brief"
    | "launch-policy";
  title: string;
  required: boolean;
  body: string;
  tokens: number;
  truth: TruthState;
  freshness: FreshnessStability;
  compatibleTargets: LaunchTargetHarness[];
  sourceIds: string[];
  provenance: CartridgeProvenance[];
}

export interface LoadProfile {
  id: LoadProfileId;
  name: string;
  state: "required" | "recommended" | "optional";
  tokenTarget: number;
  maxTokens: number;
  description: string;
  partIds: string[];
}

export interface FreshnessPolicy {
  stability: FreshnessStability;
  refreshBy: string;
  invalidatesOn: string[];
  refreshCommand?: string;
}

export interface EvalCase {
  id: string;
  name: string;
  target: LaunchTargetHarness;
  lastRun: string;
  result: EvalResult;
  truthClaim: string;
}

export interface CartridgeHistoryEntry {
  version: string;
  when: string;
  author: string;
  note: string;
}

export interface HealthMetric {
  id: "efficiency" | "freshness" | "coverage" | "provenance" | "evals";
  label: string;
  value: string;
  score: number;
  detail: string;
  tone: HealthTone;
  calculation: string;
}

export interface HealthSummary {
  metrics: HealthMetric[];
  recommendation: {
    kind: HealthRecommendation;
    tone: HealthTone;
    label: string;
    why: string;
    actions: string[];
  };
  coverageMatrix: CoverageRow[];
}

export interface CoverageRow {
  target: LaunchTargetHarness;
  cells: Record<LoadProfileId, "full" | "partial" | "none" | "n/a">;
}

export interface PlannerProposal {
  author: "agent" | "developer" | string;
  version: number;
  createdAt: string;
  summary: string;
}

export interface PlannerDecision {
  id: string;
  kind: PlannerDecisionKind;
  stageId: string;
  author: "agent" | "developer" | string;
  reason: string;
  createdAt: string;
}

export interface PlannerStage {
  id: string;
  label: string;
  title: string;
  status: PlannerStageStatus;
  charter: string;
  proposal: PlannerProposal;
  decisions: PlannerDecision[];
}

export interface PromptPart {
  slot: string;
  required: boolean;
  tokens: number;
  truth: TruthState;
  body: string;
  fromPartIds: string[];
  transform?: string;
}

export interface PlanCheck {
  id: string;
  label: string;
  tone: HealthTone;
  detail: string;
}

export interface SidecarPlan {
  path: string;
  sourcePartIds: string[];
  materialized: boolean;
}

export interface LineageLabel {
  kind: LineageKind;
  glyph: string;
  label: string;
  tone: HealthTone;
  reason: string;
}

export interface TransferDecision {
  sourcePart: string;
  action: "direct" | "transform" | "harness-native" | "drop" | "manual";
  targetSlot: string | null;
  truth: TruthState;
  reason: string;
}

export interface CartridgePlan {
  id: string;
  mode: "launch" | "fork";
  status: PlanStatus;
  target: LaunchTarget;
  profileId: LoadProfileId;
  checks: PlanCheck[];
  promptParts: PromptPart[];
  sidecars: SidecarPlan[];
  lineage: LineageLabel;
  transferDecisions?: TransferDecision[];
}

export interface ContextCartridge {
  id: string;
  name: string;
  version: string;
  lifecycle: CartridgeLifecycle;
  owner: string;
  intent: string;
  objectives: string[];
  scope: CartridgeScope;
  targets: LaunchTarget[];
  sources: CartridgeSource[];
  parts: CartridgePart[];
  profiles: LoadProfile[];
  freshness: FreshnessPolicy;
  evals: EvalCase[];
  history: CartridgeHistoryEntry[];
  planner: PlannerStage[];
  health: HealthSummary;
  plans: {
    launch: CartridgePlan;
    fork: CartridgePlan;
  };
}

export function cartridgeById(
  cartridges: readonly ContextCartridge[],
  id: string,
): ContextCartridge | undefined {
  return cartridges.find((cartridge) => cartridge.id === id);
}

export function partsForProfile(
  cartridge: ContextCartridge,
  profileId: LoadProfileId,
): CartridgePart[] {
  const profile = cartridge.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) return [];
  return profile.partIds
    .map((partId) => cartridge.parts.find((part) => part.id === partId))
    .filter((part): part is CartridgePart => Boolean(part));
}

export function profileTokenTotal(
  cartridge: ContextCartridge,
  profileId: LoadProfileId,
): number {
  return partsForProfile(cartridge, profileId).reduce((total, part) => total + part.tokens, 0);
}

export function sourcesForPart(
  cartridge: ContextCartridge,
  part: CartridgePart,
): CartridgeSource[] {
  return part.sourceIds
    .map((sourceId) => cartridge.sources.find((source) => source.id === sourceId))
    .filter((source): source is CartridgeSource => Boolean(source));
}

export function planRecord(plan: CartridgePlan): string {
  return JSON.stringify(plan, null, 2);
}
