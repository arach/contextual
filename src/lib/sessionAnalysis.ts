import { fmtTokens } from "@/lib/tokens";

export const ANALYSIS_THRESHOLDS = [70_000, 100_000, 150_000, 200_000, 250_000] as const;
export const DEFAULT_ENGINE_BUDGET = 1_000_000;

export const CONTEXT_BUCKETS = [
  {
    id: "task",
    label: "job",
    short: "job",
    color: "#c46f3a",
  },
  {
    id: "codebase",
    label: "codebase",
    short: "code",
    color: "#b9c1c8",
  },
  {
    id: "tools",
    label: "tools",
    short: "tool",
    color: "#828d96",
  },
  {
    id: "environment",
    label: "environment",
    short: "env",
    color: "#748991",
  },
  {
    id: "verification",
    label: "verification",
    short: "check",
    color: "#9b8d68",
  },
  {
    id: "decisions",
    label: "decisions",
    short: "why",
    color: "#9b7878",
  },
  {
    id: "collaboration",
    label: "collab",
    short: "team",
    color: "#748d8a",
  },
  {
    id: "policy",
    label: "policy",
    short: "rule",
    color: "#6e7780",
  },
  {
    id: "history",
    label: "history",
    short: "hist",
    color: "#4b545c",
  },
  {
    id: "media",
    label: "media",
    short: "media",
    color: "#887d8d",
  },
] as const;

export type ContextBucketId = (typeof CONTEXT_BUCKETS)[number]["id"];

export interface BucketAllocation {
  bucket: ContextBucketId;
  tokens: number;
  percent: number;
  chunks: number;
}

export interface ThresholdSnapshot {
  threshold: number;
  reached: boolean;
  coveredTokens: number;
  strategy: string;
  pinnedTokens: number;
  tailTokens: number;
  chunkRefs: string[];
  deltaFromPrevious: BucketAllocation[];
  allocations: BucketAllocation[];
}

export type ContextLifecycle =
  | "orientation"
  | "investigation"
  | "implementation"
  | "verification"
  | "handoff";

export type ContextArtifactType =
  | "instruction"
  | "task"
  | "file-read"
  | "diff"
  | "command-output"
  | "tool-call"
  | "test-log"
  | "runtime-log"
  | "screenshot"
  | "decision"
  | "handoff"
  | "summary";

export type ContextStability = "durable" | "session-local" | "stale-prone";

export interface ContextAtom {
  id: string;
  sessionId: string;
  bucket: ContextBucketId;
  tokens: number;
  rawTokenCount: number;
  label: string;
  summary: string;
  excerpt: string;
  excerptTruncated: boolean;
  pinned: boolean;
  sourceType: "message" | "tool-call" | "tool-output" | "reasoning" | "media" | "missing";
  role: string | null;
  toolName: string | null;
  command: string | null;
  lineNumber: number | null;
  messageIndex: number;
  turnIndex: number;
  contentHash: string;
  fileRefs: string[];
  lifecycle: ContextLifecycle;
  artifactType: ContextArtifactType;
  repoScope: string;
  stability: ContextStability;
}

export interface ContextSlice {
  id: string;
  sessionId: string;
  title: string;
  bucket: ContextBucketId;
  lifecycle: ContextLifecycle;
  artifactType: ContextArtifactType;
  repoScope: string;
  stability: ContextStability;
  tokens: number;
  atomRefs: string[];
  summary: string;
  quality: "candidate" | "reference" | "discard";
}

export interface BucketExample {
  id: string;
  label: string;
  tokens: number;
  summary: string;
  pinned: boolean;
  atomId: string;
  sourceType: ContextAtom["sourceType"];
  role: string | null;
  toolName: string | null;
  command: string | null;
  lineNumber: number | null;
  contentHash: string;
  fileRefs: string[];
}

export interface RecurrenceSignal {
  label: string;
  corpusSize: number;
  matchedSessions: number;
  similarityScore: number;
  recurringPatterns: string[];
  novelty: "common" | "mixed" | "novel";
  reuseCandidate: boolean;
  evidenceRefs: string[];
}

export interface BucketInsight {
  bucket: ContextBucketId;
  tokens: number;
  percent: number;
  chunks: number;
  tightness: "tight" | "mixed" | "noisy";
  significance: "high" | "medium" | "low";
  recurrence: RecurrenceSignal;
  summary: string;
  examples: BucketExample[];
}

export type AnalysisQuestionId =
  | "shape"
  | "dead-spots"
  | "repetition"
  | "similarity"
  | "summaries";

export type ContextBlockKind =
  | "task-brief"
  | "repo-map"
  | "working-set"
  | "runtime-state"
  | "verification-summary"
  | "decision-ledger"
  | "collaboration-state"
  | "policy-slice"
  | "history-capsule"
  | "artifact-index"
  | "interface-contract"
  | "active-diff-map"
  | "failure-ledger"
  | "test-surface"
  | "dependency-map"
  | "open-questions"
  | "handoff-state"
  | "discard-bin";

export interface ContextBlock {
  id: string;
  sessionId: string;
  title: string;
  kind: ContextBlockKind;
  bucket: ContextBucketId;
  tokens: number;
  sourceTokens: number;
  quality: "ready" | "review" | "discard";
  includedDefault: boolean;
  summary: string;
  body: string;
  provenance: BucketExample[];
  sliceIds: string[];
  atomRefs: string[];
  lifecycle: ContextLifecycle;
  artifactType: ContextArtifactType;
  repoScope: string;
  stability: ContextStability;
}

export interface RecipeSlot {
  id: string;
  label: string;
  targetMin: number;
  targetMax: number;
  required: boolean;
  currentTokens: number;
  missingTokens: number;
  blockIds: string[];
  replacementPolicy: "append" | "swap" | "refresh";
  freshness: ContextStability;
  status: "missing" | "thin" | "covered" | "overfilled";
  conflicts: string[];
}

export interface RecipeDraft {
  id: string;
  title: string;
  targetMin: number;
  targetMax: number;
  suggestedTokens: number;
  blocks: ContextBlock[];
  slots: RecipeSlot[];
}

export interface SessionAnalysis {
  id: string;
  project: "Scout" | "Hudson" | "Talkie";
  title: string;
  path: string;
  source: "codex" | "claude";
  timeLabel: string;
  summary: string;
  contextTokens: number;
  engineBudget: number;
  modelWindow: number | null;
  proxyTokens: number;
  chunkCount: number;
  atoms: ContextAtom[];
  slices: ContextSlice[];
  bucketTotals: BucketAllocation[];
  bucketInsights: BucketInsight[];
  recipeDraft: RecipeDraft;
  snapshots: ThresholdSnapshot[];
  classifierNotes: string[];
  goodContext?: {
    rank: number;
    label: string;
    reason: string;
    lesson: string;
    caveat: string;
  };
}

export interface SessionAnalysisResponse {
  generatedAt: string;
  thresholds: number[];
  sessions: SessionAnalysis[];
}

export interface SessionAnalysisAskRequest {
  sessionId: string;
  threshold: number;
  bucket?: ContextBucketId;
  question: string;
}

export interface SessionAnalysisAskResponse {
  answer: string;
  mode: "llm" | "heuristic";
  model?: string;
  citations: BucketExample[];
  usedAtoms: number;
}

export function bucketMeta(id: ContextBucketId) {
  return CONTEXT_BUCKETS.find((bucket) => bucket.id === id) ?? CONTEXT_BUCKETS[0];
}

export function formatAnalysisTokens(tokens: number): string {
  if (tokens >= 1_000_000) return (tokens / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return fmtTokens(Math.round(tokens));
}

export function topAllocations(
  allocations: BucketAllocation[],
  count: number = 3,
): BucketAllocation[] {
  return [...allocations].sort((a, b) => b.tokens - a.tokens).slice(0, count);
}
