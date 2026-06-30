export type DesignLifecycle = "draft" | "review" | "published" | "archived";
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

export interface DesignScope {
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

export interface DesignSource {
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

export interface DesignProvenance {
  sourceId: string;
  contentHash: string;
  observedAt: string;
  truth: TruthState;
  note: string;
}

export interface DesignPart {
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
  provenance: DesignProvenance[];
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

export interface DesignHistoryEntry {
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

export interface RunPlan {
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

export interface ContextDesign {
  id: string;
  name: string;
  version: string;
  lifecycle: DesignLifecycle;
  owner: string;
  intent: string;
  objectives: string[];
  scope: DesignScope;
  targets: LaunchTarget[];
  sources: DesignSource[];
  parts: DesignPart[];
  profiles: LoadProfile[];
  freshness: FreshnessPolicy;
  evals: EvalCase[];
  history: DesignHistoryEntry[];
  planner: PlannerStage[];
  health: HealthSummary;
  plans: {
    launch: RunPlan;
    fork: RunPlan;
  };
}

export function designById(
  designs: readonly ContextDesign[],
  id: string,
): ContextDesign | undefined {
  return designs.find((design) => design.id === id);
}

export function partsForProfile(
  design: ContextDesign,
  profileId: LoadProfileId,
): DesignPart[] {
  const profile = design.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) return [];
  return profile.partIds
    .map((partId) => design.parts.find((part) => part.id === partId))
    .filter((part): part is DesignPart => Boolean(part));
}

export function profileTokenTotal(
  design: ContextDesign,
  profileId: LoadProfileId,
): number {
  return partsForProfile(design, profileId).reduce((total, part) => total + part.tokens, 0);
}

export function sourcesForPart(
  design: ContextDesign,
  part: DesignPart,
): DesignSource[] {
  return part.sourceIds
    .map((sourceId) => design.sources.find((source) => source.id === sourceId))
    .filter((source): source is DesignSource => Boolean(source));
}

export function planRecord(plan: RunPlan): string {
  return JSON.stringify(plan, null, 2);
}
