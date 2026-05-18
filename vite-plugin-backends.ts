// Dev-only Vite plugin: routes /api/* requests to one of the registered
// Backend implementations. The Backend abstraction lives in
// src/lib/backends/types.ts; concrete implementations live alongside it.
//
// Routes:
//   POST /api/dispatch   body: DispatchRequest
//   POST /api/branch     body: BranchRequest
//   GET  /api/tree       pi-coding-agent only (Contextual manifest TBD)
//   GET  /api/workspace?threadId=…   pi-coding-agent only

import type { Connect, Plugin } from "vite";
import type { ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import {
  complete,
  getEnvApiKey,
  getModel,
  type AssistantMessage,
  type TextContent,
} from "@earendil-works/pi-ai";

import {
  ensureBackendDirs,
  gatherTree,
  gatherWorkspace,
  piCodingAgentBackend,
} from "./src/lib/backends/pi-coding-agent";
import { piAiBackend } from "./src/lib/backends/pi-ai";
import { authStatus, getOAuthApiKey, loginProvider } from "./src/lib/backends/oauth";
import type {
  Backend,
  BranchRequest,
  DispatchRequest,
} from "./src/lib/backends/types";
import type {
  BucketAllocation,
  BucketExample,
  BucketInsight,
  ContextArtifactType,
  ContextAtom,
  ContextBlock,
  ContextBlockKind,
  ContextBucketId,
  ContextLifecycle,
  ContextSlice,
  ContextStability,
  RecipeDraft,
  RecipeSlot,
  RecurrenceSignal,
  SessionAnalysisAskRequest,
  SessionAnalysisAskResponse,
  SessionAnalysis,
  SessionAnalysisResponse,
  ThresholdSnapshot,
} from "./src/lib/sessionAnalysis";

const BACKENDS: Record<string, Backend> = {
  "pi-coding-agent": piCodingAgentBackend,
  "pi-ai": piAiBackend,
};

const HOME = process.env.HOME ?? "/Users/arach";
const DEFAULT_ENGINE_BUDGET = 1_000_000;
const ANALYSIS_THRESHOLDS = [70_000, 100_000, 150_000, 200_000, 250_000];
const BUCKET_ORDER: ContextBucketId[] = [
  "task",
  "codebase",
  "tools",
  "environment",
  "verification",
  "decisions",
  "collaboration",
  "policy",
  "history",
  "media",
];

interface SessionSource {
  id: string;
  project: SessionAnalysis["project"];
  title: string;
  path: string;
  source: SessionAnalysis["source"];
  timeLabel: string;
  summary: string;
}

interface ClassifiedChunk {
  bucket: ContextBucketId;
  tokens: number;
  pinned?: boolean;
  label: string;
  summary: string;
  excerpt?: string;
  excerptTruncated?: boolean;
  sourceType?: ContextAtom["sourceType"];
  role?: string | null;
  toolName?: string | null;
  command?: string | null;
  lineNumber?: number | null;
  messageIndex?: number;
  turnIndex?: number;
  rawTokenCount?: number;
  fileRefs?: string[];
  contentHash?: string;
  lifecycle?: ContextLifecycle;
  artifactType?: ContextArtifactType;
  repoScope?: string;
  stability?: ContextStability;
}

type AnalyzedChunk = ClassifiedChunk &
  ContextAtom & {
    tokens: number;
  };

interface ChunkMeta {
  sourceType?: ContextAtom["sourceType"];
  role?: string | null;
  toolName?: string | null;
  command?: string | null;
  lineNumber?: number | null;
  messageIndex?: number;
  turnIndex?: number;
}

const SESSION_SOURCES: SessionSource[] = [
  {
    id: "019e2cf4-779b-7be1-8dde-e0db3069bafa",
    project: "Scout",
    title: "CLI Outside-In Review",
    source: "codex",
    timeLabel: "May 15, 2026",
    path: `${HOME}/.codex/sessions/2026/05/15/rollout-2026-05-15T14-44-39-019e2cf4-779b-7be1-8dde-e0db3069bafa.jsonl`,
    summary:
      "Cold-user review of Scout CLI semantics: send, ask, receipts, flight get/wait, watch, and source-vs-dist drift.",
  },
  {
    id: "019e2d23-c1d1-7532-ae44-d16f3ba1931f",
    project: "Scout",
    title: "DataTable Consolidation",
    source: "codex",
    timeLabel: "May 15, 2026",
    path: `${HOME}/.codex/sessions/2026/05/15/rollout-2026-05-15T15-36-18-019e2d23-c1d1-7532-ae44-d16f3ba1931f.jsonl`,
    summary:
      "Implementation session consolidating Scout web table variants into a shared DataTable with branch and commit handoff state.",
  },
  {
    id: "019e22a8-1d29-7d10-b925-56c0abd4499e",
    project: "Scout",
    title: "Network Signals Failures",
    source: "codex",
    timeLabel: "May 13, 2026",
    path: `${HOME}/.codex/sessions/2026/05/13/rollout-2026-05-13T14-45-03-019e22a8-1d29-7d10-b925-56c0abd4499e.jsonl`,
    summary:
      "Root-cause pass on stale Ask failed rows caused by loose invocation/status correlation in Network Signals.",
  },
  {
    id: "1c212173-4351-4a2a-a9e2-1a98fdc5f5b2",
    project: "Hudson",
    title: "Talkie Icon Lab Integration",
    source: "claude",
    timeLabel: "May 12, 2026",
    path: `${HOME}/.claude/projects/-Users-arach-dev-hudson/1c212173-4351-4a2a-a9e2-1a98fdc5f5b2.jsonl`,
    summary:
      "Talkie icon exploration through Hudson, including glyph studies, generated assets, routing, and app-placement decisions.",
  },
  {
    id: "2933e137-d032-4d49-b247-ca04294fca35",
    project: "Hudson",
    title: "HUD-006 AI Backends",
    source: "claude",
    timeLabel: "May 12, 2026",
    path: `${HOME}/.claude/projects/-Users-arach-dev-hudson/2933e137-d032-4d49-b247-ca04294fca35.jsonl`,
    summary:
      "Spec-to-package implementation for @hudson/ai-backends and the pi-ai adapter, with tests and PR handoff.",
  },
  {
    id: "1bba6434-5c37-4aa6-9299-de63f7e51ae8",
    project: "Hudson",
    title: "HUD-007 App Controls",
    source: "claude",
    timeLabel: "May 12-14, 2026",
    path: `${HOME}/.claude/projects/-Users-arach-dev-hudson/1bba6434-5c37-4aa6-9299-de63f7e51ae8.jsonl`,
    summary:
      "HudsonKit primitive layer work: control APIs, package exports, design-token assumptions, and build output.",
  },
  {
    id: "019e24c0-6cfe-7b43-8e9e-5305cb3ec125",
    project: "Talkie",
    title: "iOS Build / CloudKit",
    source: "codex",
    timeLabel: "May 14, 2026",
    path: `${HOME}/.codex/sessions/2026/05/14/rollout-2026-05-14T00-30-51-019e24c0-6cfe-7b43-8e9e-5305cb3ec125.jsonl`,
    summary:
      "Talkie iOS build/run investigation separating simulator build, simulator launch crash, CloudKit entitlement, and device provisioning blockers.",
  },
  {
    id: "019e17c8-fec1-7753-91e0-e1d77b6e683f",
    project: "Talkie",
    title: "Menu Bar State Mark",
    source: "codex",
    timeLabel: "May 11, 2026",
    path: `${HOME}/.codex/sessions/2026/05/11/rollout-2026-05-11T12-05-08-019e17c8-fec1-7753-91e0-e1d77b6e683f.jsonl`,
    summary:
      "Talkie brand-state implementation tying screenshots, color semantics, asset catalogs, Swift renderer changes, and verification.",
  },
  {
    id: "019e140c-e691-75c2-8782-651d3b4ebc99",
    project: "Talkie",
    title: "Private Identifier Plan",
    source: "codex",
    timeLabel: "May 10, 2026",
    path: `${HOME}/.codex/sessions/2026/05/10/rollout-2026-05-10T18-40-50-019e140c-e691-75c2-8782-651d3b4ebc99.jsonl`,
    summary:
      "Read-only inventory of signing identifiers, CloudKit containers, app groups, XcodeGen sources, generated pbxproj, and release overrides.",
  },
];

const GOOD_CONTEXTS: Record<string, NonNullable<SessionAnalysis["goodContext"]>> = {
  "019e22a8-1d29-7d10-b925-56c0abd4499e": {
    rank: 1,
    label: "root-cause debugging",
    reason:
      "A focused Scout failure investigation with enough code reading and broker semantics to explain the bug without becoming a general repo tour.",
    lesson:
      "Good context is narrow, evidence-backed, and anchored in the failing behavior before code changes start.",
    caveat:
      "It is still code-heavy, so repeated file reads should be compressed into a working-set map.",
  },
  "2933e137-d032-4d49-b247-ca04294fca35": {
    rank: 2,
    label: "spec-to-package implementation",
    reason:
      "A Hudson package session with project state, implementation work, and verification signals in a compact enough window.",
    lesson:
      "The useful warm-up is the contract, package boundaries, and tests, not the full transcript.",
    caveat:
      "Environment and verification chunks should stay fresh because package state can drift quickly.",
  },
  "1c212173-4351-4a2a-a9e2-1a98fdc5f5b2": {
    rank: 3,
    label: "product and asset exploration",
    reason:
      "A rich Hudson/Talkie visual session with product intent, generated artifacts, and placement decisions.",
    lesson:
      "Creative sessions need a decision ledger plus artifact index so the model can keep taste and asset state straight.",
    caveat:
      "Media-heavy context needs thumbnails or descriptions; raw asset traces are easy to over-carry.",
  },
  "019e24c0-6cfe-7b43-8e9e-5305cb3ec125": {
    rank: 4,
    label: "native runtime triage",
    reason:
      "A Talkie iOS session that separates build state, launch crash, CloudKit entitlement, and device provisioning blockers.",
    lesson:
      "Runtime context is valuable when it clearly distinguishes what was tested, what failed, and what remains blocked.",
    caveat:
      "Setup-heavy context gets stale fastest and should be refreshed before reuse.",
  },
};

function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const rec = part as Record<string, unknown>;
      const text = rec.text ?? rec.content ?? rec.thinking;
      if (typeof text === "string") return text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function mediaTokenCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((sum, part) => {
    if (!part || typeof part !== "object") return sum;
    const rec = part as Record<string, unknown>;
    const type = String(rec.type ?? "");
    if (type.includes("image") || type.includes("screenshot")) return sum + 1200;
    return sum;
  }, 0);
}

function shortSummary(text: string, fallback: string): string {
  const normalized = text
    .replace(/Chunk ID:\s*[^\n]+/g, "")
    .replace(/Wall time:\s*[^\n]+/g, "")
    .replace(/Process exited with code\s+\d+/g, "")
    .replace(/Original token count:\s*\d+/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !line.startsWith("Output:"));
  if (normalized && /^\d+\s/.test(normalized) && fallback.includes("/")) {
    return fallback.slice(0, 180);
  }
  return (normalized || fallback).slice(0, 180);
}

function parseCommand(argumentsJson: unknown): string {
  if (typeof argumentsJson !== "string") return "";
  try {
    const args = JSON.parse(argumentsJson) as Record<string, unknown>;
    return String(args.cmd ?? args.command ?? args.file_path ?? args.path ?? "");
  } catch {
    return argumentsJson;
  }
}

function originalTokenCount(output: string): number | null {
  const match = output.match(/Original token count:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function extractFileRefs(text: string): string[] {
  const refs = new Set<string>();
  const patterns = [
    /(?:^|\s)(\/Users\/arach\/[^\s"'`:)]+(?:\.(?:ts|tsx|js|jsx|mjs|css|html|json|md|toml|ya?ml|swift|plist|pbxproj|lock|lockb))?)/g,
    /(?:^|\s)([\w./@-]+\.(?:ts|tsx|js|jsx|mjs|css|html|json|md|toml|ya?ml|swift|plist|pbxproj|lock|lockb))/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1]?.replace(/[),.;:]+$/, "");
      if (value && !value.includes("node_modules")) refs.add(value);
      if (refs.size >= 8) break;
    }
  }
  return [...refs].slice(0, 8);
}

function artifactTypeFor(chunk: ClassifiedChunk): ContextArtifactType {
  const command = (chunk.command ?? chunk.label).toLowerCase();
  const summary = chunk.summary.toLowerCase();
  if (chunk.sourceType === "media") return "screenshot";
  if (chunk.sourceType === "tool-call") return "tool-call";
  if (chunk.bucket === "policy") return "instruction";
  if (chunk.bucket === "task") return "task";
  if (chunk.bucket === "decisions" || chunk.sourceType === "reasoning") return "decision";
  if (chunk.bucket === "collaboration") return "handoff";
  if (command.includes("git diff") || command.includes("diff --git")) return "diff";
  if (
    command.includes("bun test") ||
    command.includes("vitest") ||
    command.includes("pytest") ||
    summary.includes("test failed")
  ) {
    return "test-log";
  }
  if (
    command.includes("bun run build") ||
    command.includes("xcodebuild") ||
    command.includes("swift build") ||
    summary.includes("build failed")
  ) {
    return "test-log";
  }
  if (
    command.includes("simulator") ||
    command.includes("lsof") ||
    command.includes("localhost") ||
    summary.includes("provisioning") ||
    summary.includes("cloudkit")
  ) {
    return "runtime-log";
  }
  if (
    command.includes("sed ") ||
    command.includes("cat ") ||
    command.includes("rg ") ||
    command.includes("git show") ||
    command.includes("plutil") ||
    chunk.fileRefs?.length
  ) {
    return "file-read";
  }
  if (chunk.sourceType === "tool-output") return "command-output";
  return "summary";
}

function lifecycleFor(chunk: ClassifiedChunk, artifactType: ContextArtifactType): ContextLifecycle {
  if (chunk.bucket === "policy" || chunk.bucket === "task" || chunk.bucket === "environment") {
    return "orientation";
  }
  if (artifactType === "diff" || chunk.bucket === "tools") return "implementation";
  if (chunk.bucket === "verification" || artifactType === "test-log") return "verification";
  if (chunk.bucket === "collaboration" || artifactType === "handoff") return "handoff";
  return "investigation";
}

function stabilityFor(chunk: ClassifiedChunk, artifactType: ContextArtifactType): ContextStability {
  if (chunk.bucket === "policy" || chunk.bucket === "task" || chunk.bucket === "decisions") return "durable";
  if (chunk.bucket === "environment" || artifactType === "runtime-log" || artifactType === "test-log") {
    return "stale-prone";
  }
  if (chunk.bucket === "tools" || chunk.bucket === "media") return "session-local";
  return "durable";
}

function repoScopeFor(source: SessionSource, chunk: ClassifiedChunk): string {
  const fileRef = chunk.fileRefs?.find(Boolean);
  if (fileRef?.includes("/dev/")) {
    const [, afterDev] = fileRef.split("/dev/");
    return afterDev?.split(/[/.]/)[0] || source.project;
  }
  const lower = `${chunk.command ?? ""}\n${chunk.summary}\n${chunk.label}`.toLowerCase();
  if (lower.includes("scout")) return "scout";
  if (lower.includes("hudson")) return "hudson";
  if (lower.includes("talkie")) return "talkie";
  return source.project.toLowerCase();
}

function classifyUserText(text: string): ContextBucketId {
  const lower = text.toLowerCase();
  if (lower.includes("subagent_notification")) {
    return "collaboration";
  }
  if (
    lower.includes("agents.md instructions") ||
    lower.includes("permissions instructions") ||
    lower.includes("available skills") ||
    lower.includes("project-doc") ||
    lower.includes("developer instructions")
  ) {
    return "policy";
  }
  if (
    lower.includes("error message") ||
    lower.includes("crash report") ||
    lower.includes("my request") ||
    lower.includes("what i would like") ||
    lower.includes("please") ||
    lower.includes("build") ||
    lower.includes("fix") ||
    lower.includes("why")
  ) {
    return "task";
  }
  if (
    lower.includes("scout") ||
    lower.includes("broker") ||
    lower.includes("flight") ||
    lower.includes("handoff")
  ) {
    return "collaboration";
  }
  return "history";
}

function classifyAssistantText(text: string): ContextBucketId {
  const lower = text.toLowerCase();
  if (
    lower.includes("root cause") ||
    lower.includes("decided") ||
    lower.includes("settled") ||
    lower.includes("rationale") ||
    lower.includes("recommend") ||
    lower.includes("summary") ||
    lower.includes("plan")
  ) {
    return "decisions";
  }
  if (
    lower.includes("subagent") ||
    lower.includes("scout") ||
    lower.includes("broker") ||
    lower.includes("handoff") ||
    lower.includes("flight")
  ) {
    return "collaboration";
  }
  return "history";
}

function classifyToolOutput(output: string, command: string): ContextBucketId {
  const commandLower = command.toLowerCase();
  const lower = `${command}\n${output.slice(0, 8000)}`.toLowerCase();
  if (
    commandLower.includes("xcodebuild") ||
    commandLower.includes("bun run build") ||
    commandLower.includes("bun test") ||
    commandLower.includes("typecheck") ||
    commandLower.includes("vite build") ||
    commandLower.includes("swift build") ||
    commandLower.includes("pytest") ||
    commandLower.includes("vitest") ||
    lower.includes("test failed") ||
    lower.includes("build failed")
  ) {
    return "verification";
  }
  if (
    commandLower.includes("git status") ||
    commandLower.includes("git branch") ||
    commandLower.includes("lsof") ||
    commandLower.includes("pwd") ||
    commandLower.includes("ls -ld") ||
    lower.includes("current branch") ||
    lower.includes("localhost") ||
    lower.includes("simulator") ||
    lower.includes("device") ||
    lower.includes("provisioning") ||
    lower.includes("cloudkit") ||
    lower.includes("entitlement")
  ) {
    return "environment";
  }
  if (
    commandLower.includes("sed ") ||
    commandLower.startsWith("rg ") ||
    commandLower.includes(" rg ") ||
    commandLower.startsWith("cat ") ||
    commandLower.includes(" cat ") ||
    commandLower.includes("plutil") ||
    commandLower.includes("read") ||
    commandLower.includes("git show") ||
    commandLower.includes("git diff")
  ) {
    return "codebase";
  }
  if (
    lower.includes("scout") ||
    lower.includes("broker") ||
    lower.includes("subagent") ||
    lower.includes("invocation") ||
    lower.includes("flight") ||
    lower.includes("ask failed")
  ) {
    return "collaboration";
  }
  if (
    lower.includes("sed -n") ||
    lower.includes("rg ") ||
    lower.includes("read") ||
    lower.includes("cat ") ||
    lower.includes(".tsx") ||
    lower.includes(".ts") ||
    lower.includes(".swift") ||
    lower.includes(".json") ||
    lower.includes("package.json") ||
    lower.includes("project.pbxproj") ||
    lower.includes("plutil")
  ) {
    return "codebase";
  }
  return "tools";
}

function pushChunk(
  chunks: ClassifiedChunk[],
  bucket: ContextBucketId,
  text: string,
  tokenOverride?: number | null,
  pinned: boolean = bucket === "policy" || bucket === "environment" || bucket === "task",
  label: string = bucket,
  meta: ChunkMeta = {},
): void {
  const trimmed = text.trim();
  if (!trimmed && !tokenOverride) return;
  const fileRefs = extractFileRefs(`${label}\n${trimmed}`);
  const rawTokenCount = Math.max(1, tokenOverride ?? approxTokens(trimmed));
  const excerptLimit = 2_400;
  const excerpt = trimmed.slice(0, excerptLimit);
  chunks.push({
    bucket,
    tokens: rawTokenCount,
    pinned,
    label,
    summary: shortSummary(trimmed, label),
    excerpt,
    excerptTruncated: trimmed.length > excerptLimit,
    sourceType: meta.sourceType ?? "message",
    role: meta.role ?? null,
    toolName: meta.toolName ?? null,
    command: meta.command ?? null,
    lineNumber: meta.lineNumber ?? null,
    messageIndex: meta.messageIndex,
    turnIndex: meta.turnIndex,
    rawTokenCount,
    fileRefs,
    contentHash: hashText(`${label}\n${trimmed}`),
  });
}

function allocationsFrom(
  scaledChunks: ClassifiedChunk[],
  coveredTokens: number,
): BucketAllocation[] {
  const tokensByBucket = new Map<ContextBucketId, { tokens: number; chunks: number }>(
    BUCKET_ORDER.map((bucket) => [bucket, { tokens: 0, chunks: 0 }]),
  );
  for (const chunk of scaledChunks) {
    const current = tokensByBucket.get(chunk.bucket);
    if (!current) continue;
    current.tokens += chunk.tokens;
    current.chunks += 1;
  }
  return BUCKET_ORDER.map((bucket) => {
    const current = tokensByBucket.get(bucket) ?? { tokens: 0, chunks: 0 };
    return {
      bucket,
      tokens: Math.round(current.tokens),
      percent: coveredTokens > 0 ? (current.tokens / coveredTokens) * 100 : 0,
      chunks: current.chunks,
    };
  });
}

function snapshotAt(
  scaledChunks: AnalyzedChunk[],
  threshold: number,
  contextTokens: number,
): ThresholdSnapshot {
  const coveredTokens = Math.min(threshold, contextTokens);
  let remaining = coveredTokens;
  let pinnedTokens = 0;
  let tailTokens = 0;
  const chunks: AnalyzedChunk[] = [];
  const used = new Set<number>();

  for (const [index, chunk] of scaledChunks.entries()) {
    if (remaining <= 0) break;
    if (!chunk.pinned) continue;
    const tokens = Math.min(chunk.tokens, remaining);
    chunks.push({ ...chunk, tokens });
    pinnedTokens += tokens;
    used.add(index);
    remaining -= tokens;
  }

  for (let index = scaledChunks.length - 1; index >= 0; index -= 1) {
    if (remaining <= 0) break;
    if (used.has(index)) continue;
    const chunk = scaledChunks[index];
    if (!chunk) continue;
    const tokens = Math.min(chunk.tokens, remaining);
    chunks.push({ ...chunk, tokens });
    tailTokens += tokens;
    remaining -= tokens;
  }

  return {
    threshold,
    reached: threshold <= contextTokens,
    coveredTokens: Math.round(coveredTokens),
    strategy: "pinned policy/task/environment plus recent tail",
    pinnedTokens: Math.round(pinnedTokens),
    tailTokens: Math.round(tailTokens),
    chunkRefs: chunks.map((chunk) => chunk.id),
    deltaFromPrevious: [],
    allocations: allocationsFrom(chunks, coveredTokens),
  };
}

function withSnapshotDeltas(snapshots: ThresholdSnapshot[]): ThresholdSnapshot[] {
  return snapshots.map((snapshot, index) => {
    const previous = snapshots[index - 1];
    const deltaTokens = Math.max(1, snapshot.coveredTokens - (previous?.coveredTokens ?? 0));
    const previousByBucket = new Map(
      previous?.allocations.map((allocation) => [allocation.bucket, allocation]) ?? [],
    );
    return {
      ...snapshot,
      deltaFromPrevious: snapshot.allocations.map((allocation) => {
        const prior = previousByBucket.get(allocation.bucket);
        const tokens = Math.max(0, allocation.tokens - (prior?.tokens ?? 0));
        const chunks = Math.max(0, allocation.chunks - (prior?.chunks ?? 0));
        return {
          bucket: allocation.bucket,
          tokens,
          chunks,
          percent: (tokens / deltaTokens) * 100,
        };
      }),
    };
  });
}

function insightSummary(bucket: ContextBucketId, examples: ClassifiedChunk[], percent: number): string {
  const lead = examples[0]?.summary ?? "No meaningful chunks found.";
  const prefix: Record<ContextBucketId, string> = {
    task: "Task shape",
    codebase: "Codebase reading",
    tools: "Tool activity",
    environment: "Environment state",
    verification: "Verification evidence",
    decisions: "Decision trail",
    collaboration: "Collaboration layer",
    policy: "Policy and instructions",
    history: "History load",
    media: "Media artifacts",
  };
  return `${prefix[bucket]} accounts for ${Math.round(percent)}% of this analyzed context. Largest signal: ${lead}`;
}

function tightnessFor(chunks: ClassifiedChunk[], tokens: number): BucketInsight["tightness"] {
  if (!chunks.length) return "tight";
  const sorted = [...chunks].sort((a, b) => b.tokens - a.tokens);
  const topShare = sorted.slice(0, 3).reduce((sum, chunk) => sum + chunk.tokens, 0) / Math.max(1, tokens);
  if (chunks.length > 60 && topShare < 0.5) return "noisy";
  if (chunks.length > 24 && topShare < 0.35) return "mixed";
  return "tight";
}

function significanceFor(percent: number, chunks: ClassifiedChunk[]): BucketInsight["significance"] {
  if (percent >= 25 || chunks.some((chunk) => chunk.pinned && chunk.tokens > 3000)) return "high";
  if (percent >= 8 || chunks.length >= 8) return "medium";
  return "low";
}

function emptyRecurrence(): RecurrenceSignal {
  return {
    label: "comparison pending",
    corpusSize: 0,
    matchedSessions: 0,
    similarityScore: 0,
    recurringPatterns: [],
    novelty: "novel",
    reuseCandidate: false,
    evidenceRefs: [],
  };
}

function buildBucketInsights(
  scaledChunks: AnalyzedChunk[],
  contextTokens: number,
): BucketInsight[] {
  return BUCKET_ORDER.map((bucket) => {
    const chunks = scaledChunks.filter((chunk) => chunk.bucket === bucket);
    const tokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
    const percent = contextTokens > 0 ? (tokens / contextTokens) * 100 : 0;
    const examples = [...chunks]
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5)
      .map((chunk, index) => ({
        id: `${bucket}-${index}`,
        atomId: chunk.id,
        label: chunk.label,
        tokens: Math.round(chunk.tokens),
        summary: chunk.summary,
        pinned: Boolean(chunk.pinned),
        sourceType: chunk.sourceType,
        role: chunk.role,
        toolName: chunk.toolName,
        command: chunk.command,
        lineNumber: chunk.lineNumber,
        contentHash: chunk.contentHash,
        fileRefs: chunk.fileRefs,
      }));
    return {
      bucket,
      tokens: Math.round(tokens),
      percent,
      chunks: chunks.length,
      tightness: tightnessFor(chunks, tokens),
      significance: significanceFor(percent, chunks),
      recurrence: { ...emptyRecurrence(), evidenceRefs: examples.map((example) => example.atomId) },
      summary: insightSummary(bucket, chunks, percent),
      examples,
    };
  });
}

const BLOCK_KIND_BY_BUCKET: Record<ContextBucketId, ContextBlockKind> = {
  task: "task-brief",
  codebase: "repo-map",
  tools: "artifact-index",
  environment: "runtime-state",
  verification: "verification-summary",
  decisions: "decision-ledger",
  collaboration: "collaboration-state",
  policy: "policy-slice",
  history: "history-capsule",
  media: "artifact-index",
};

const BLOCK_TOKEN_BOUNDS: Record<ContextBucketId, { min: number; max: number; ratio: number }> = {
  task: { min: 2_000, max: 8_000, ratio: 0.22 },
  codebase: { min: 8_000, max: 34_000, ratio: 0.16 },
  tools: { min: 2_000, max: 12_000, ratio: 0.08 },
  environment: { min: 3_000, max: 14_000, ratio: 0.12 },
  verification: { min: 3_000, max: 16_000, ratio: 0.14 },
  decisions: { min: 3_000, max: 14_000, ratio: 0.24 },
  collaboration: { min: 2_500, max: 12_000, ratio: 0.14 },
  policy: { min: 2_000, max: 10_000, ratio: 0.12 },
  history: { min: 1_500, max: 8_000, ratio: 0.07 },
  media: { min: 1_500, max: 8_000, ratio: 0.08 },
};

function blockQuality(insight: BucketInsight): ContextBlock["quality"] {
  if (insight.significance === "low" || insight.percent < 2) return "discard";
  if (insight.tightness === "noisy" || insight.bucket === "tools" || insight.bucket === "history") {
    return "review";
  }
  return "ready";
}

function compressedTokensFor(bucket: ContextBucketId, sourceTokens: number): number {
  const bounds = BLOCK_TOKEN_BOUNDS[bucket];
  if (sourceTokens <= 0) return 0;
  return Math.round(Math.max(bounds.min, Math.min(bounds.max, sourceTokens * bounds.ratio)));
}

function sliceTitle(slice: ContextSlice): string {
  return `${slice.lifecycle} ${slice.artifactType}`.replace(/-/g, " ");
}

function buildContextSlices(source: SessionSource, chunks: AnalyzedChunk[]): ContextSlice[] {
  const groups = new Map<string, AnalyzedChunk[]>();
  for (const chunk of chunks) {
    const key = [
      chunk.bucket,
      chunk.lifecycle,
      chunk.artifactType,
      chunk.repoScope,
      chunk.stability,
    ].join(":");
    groups.set(key, [...(groups.get(key) ?? []), chunk]);
  }

  return [...groups.entries()]
    .map(([key, group], index) => {
      const [bucket, lifecycle, artifactType, repoScope, stability] = key.split(":") as [
        ContextBucketId,
        ContextLifecycle,
        ContextArtifactType,
        string,
        ContextStability,
      ];
      const tokens = Math.round(group.reduce((sum, chunk) => sum + chunk.tokens, 0));
      const sorted = [...group].sort((a, b) => b.tokens - a.tokens);
      const summary = `${sliceTitle({
        id: "",
        sessionId: source.id,
        title: "",
        bucket,
        lifecycle,
        artifactType,
        repoScope,
        stability,
        tokens,
        atomRefs: [],
        summary: "",
        quality: "candidate",
      })} slice for ${repoScope}: ${sorted.slice(0, 3).map((chunk) => chunk.summary).join(" / ")}`;
      return {
        id: `${source.id}:slice:${index}`,
        sessionId: source.id,
        title: `${bucket} · ${sliceTitle({
          id: "",
          sessionId: source.id,
          title: "",
          bucket,
          lifecycle,
          artifactType,
          repoScope,
          stability,
          tokens,
          atomRefs: [],
          summary: "",
          quality: "candidate",
        })}`,
        bucket,
        lifecycle,
        artifactType,
        repoScope,
        stability,
        tokens,
        atomRefs: sorted.map((chunk) => chunk.id),
        summary: summary.slice(0, 320),
        quality: tokens >= 3_000 ? "candidate" : tokens >= 900 ? "reference" : "discard",
      } satisfies ContextSlice;
    })
    .sort((a, b) => b.tokens - a.tokens);
}

function examplesForAtoms(chunks: ContextAtom[], atomRefs: string[], limit = 5): BucketInsight["examples"] {
  const wanted = new Set(atomRefs);
  return chunks
    .filter((chunk) => wanted.has(chunk.id))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, limit)
    .map((chunk, index) => ({
      id: `${chunk.bucket}-${index}`,
      atomId: chunk.id,
      label: chunk.label,
      tokens: Math.round(chunk.tokens),
      summary: chunk.summary,
      pinned: Boolean(chunk.pinned),
      sourceType: chunk.sourceType,
      role: chunk.role,
      toolName: chunk.toolName,
      command: chunk.command,
      lineNumber: chunk.lineNumber,
      contentHash: chunk.contentHash,
      fileRefs: chunk.fileRefs,
    }));
}

function kindForSlice(slice: ContextSlice): ContextBlockKind {
  if (slice.artifactType === "diff") return "active-diff-map";
  if (slice.artifactType === "test-log") return slice.bucket === "verification" ? "test-surface" : "failure-ledger";
  if (slice.artifactType === "handoff") return "handoff-state";
  if (slice.artifactType === "file-read" && slice.bucket === "codebase") return "working-set";
  if (slice.bucket === "codebase" && slice.repoScope !== "contextual") return "dependency-map";
  return BLOCK_KIND_BY_BUCKET[slice.bucket];
}

function blockQualityForSlice(slice: ContextSlice, insight: BucketInsight | undefined): ContextBlock["quality"] {
  if (slice.quality === "discard" || (insight && blockQuality(insight) === "discard")) return "discard";
  if (slice.quality === "reference" || slice.stability === "session-local" || slice.bucket === "tools" || slice.bucket === "history") {
    return "review";
  }
  return blockQuality(insight ?? {
    bucket: slice.bucket,
    tokens: slice.tokens,
    percent: 10,
    chunks: slice.atomRefs.length,
    tightness: "mixed",
    significance: "medium",
    recurrence: emptyRecurrence(),
    summary: slice.summary,
    examples: [],
  });
}

function blockBodyFromSlice(slice: ContextSlice, insight: BucketInsight | undefined, provenance: BucketInsight["examples"]): string {
  const lines = [
    slice.summary,
    "",
    `Lifecycle: ${slice.lifecycle}. Artifact: ${slice.artifactType}. Stability: ${slice.stability}.`,
    `Scope: ${slice.repoScope}. Source atoms: ${slice.atomRefs.length}.`,
    insight ? `Bucket signal: ${insight.significance}; recurrence: ${insight.recurrence.label}.` : "",
    "",
    "Representative source atoms:",
    ...provenance.map((example) => {
      const location = example.lineNumber ? ` line ${example.lineNumber}` : "";
      const command = example.command ? ` · ${example.command.slice(0, 90)}` : "";
      return `- ${example.label}${location} (${Math.round(example.tokens)} tokens)${command}: ${example.summary}`;
    }),
  ];
  return lines.filter(Boolean).join("\n");
}

function buildContextBlocks(
  source: SessionSource,
  insights: BucketInsight[],
  slices: ContextSlice[],
  chunks: ContextAtom[],
): ContextBlock[] {
  const insightByBucket = new Map(insights.map((insight) => [insight.bucket, insight]));
  return slices
    .filter((slice) => slice.tokens > 0)
    .slice(0, 24)
    .map((slice) => {
      const insight = insightByBucket.get(slice.bucket);
      const provenance = examplesForAtoms(chunks, slice.atomRefs);
      const quality = blockQualityForSlice(slice, insight);
      return {
        id: `${slice.id}:block`,
        sessionId: source.id,
        title: `${source.title} · ${slice.title}`,
        kind: kindForSlice(slice),
        bucket: slice.bucket,
        tokens: compressedTokensFor(slice.bucket, slice.tokens),
        sourceTokens: slice.tokens,
        quality,
        includedDefault: false,
        summary: slice.summary,
        body: blockBodyFromSlice(slice, insight, provenance),
        provenance,
        sliceIds: [slice.id],
        atomRefs: slice.atomRefs,
        lifecycle: slice.lifecycle,
        artifactType: slice.artifactType,
        repoScope: slice.repoScope,
        stability: slice.stability,
      } satisfies ContextBlock;
    });
}

interface SlotTemplate {
  id: string;
  label: string;
  targetMin: number;
  targetMax: number;
  required: boolean;
  replacementPolicy: RecipeSlot["replacementPolicy"];
  freshness: ContextStability;
}

const SLOT_TEMPLATES: SlotTemplate[] = [
  { id: "task-brief", label: "task brief", targetMin: 8_000, targetMax: 12_000, required: true, replacementPolicy: "refresh", freshness: "durable" },
  { id: "world-map", label: "world map", targetMin: 28_000, targetMax: 36_000, required: true, replacementPolicy: "swap", freshness: "durable" },
  { id: "active-state", label: "active state", targetMin: 18_000, targetMax: 26_000, required: true, replacementPolicy: "refresh", freshness: "stale-prone" },
  { id: "evidence", label: "evidence", targetMin: 18_000, targetMax: 28_000, required: true, replacementPolicy: "refresh", freshness: "stale-prone" },
  { id: "decisions", label: "decisions", targetMin: 8_000, targetMax: 14_000, required: true, replacementPolicy: "append", freshness: "durable" },
  { id: "handoff", label: "handoff", targetMin: 8_000, targetMax: 12_000, required: false, replacementPolicy: "append", freshness: "session-local" },
];

function slotIdForBlock(block: ContextBlock): string {
  if (block.kind === "task-brief" || block.kind === "open-questions") return "task-brief";
  if (["repo-map", "working-set", "interface-contract", "dependency-map", "policy-slice"].includes(block.kind)) return "world-map";
  if (["runtime-state", "active-diff-map", "collaboration-state"].includes(block.kind)) return "active-state";
  if (["verification-summary", "test-surface", "failure-ledger", "artifact-index"].includes(block.kind)) return "evidence";
  if (block.kind === "decision-ledger") return "decisions";
  return "handoff";
}

function buildRecipeDraft(source: SessionSource, blocks: ContextBlock[]): RecipeDraft {
  const planned = blocks.map((block) => ({ ...block, includedDefault: false }));
  const used = new Set<string>();

  for (const slot of SLOT_TEMPLATES) {
    let current = 0;
    const candidates = planned
      .filter((block) => slotIdForBlock(block) === slot.id && block.quality !== "discard")
      .sort((a, b) => {
        const qualityDelta = (a.quality === "ready" ? 0 : 1) - (b.quality === "ready" ? 0 : 1);
        return qualityDelta || b.sourceTokens - a.sourceTokens;
      });
    for (const block of candidates) {
      if (current >= slot.targetMin && (!slot.required || block.quality !== "ready")) continue;
      if (current + block.tokens > slot.targetMax * 1.35 && current >= slot.targetMin) continue;
      block.includedDefault = true;
      used.add(block.id);
      current += block.tokens;
    }
  }

  let total = planned.filter((block) => block.includedDefault).reduce((sum, block) => sum + block.tokens, 0);
  for (const block of planned
    .filter((candidate) => !used.has(candidate.id) && candidate.quality === "review")
    .sort((a, b) => b.sourceTokens - a.sourceTokens)) {
    if (total >= 100_000) break;
    block.includedDefault = true;
    total += block.tokens;
  }

  const slots = SLOT_TEMPLATES.map((slot) => {
    const slotBlocks = planned.filter((block) => slotIdForBlock(block) === slot.id && block.includedDefault);
    const currentTokens = slotBlocks.reduce((sum, block) => sum + block.tokens, 0);
    const missingTokens = Math.max(0, slot.targetMin - currentTokens);
    const status: RecipeSlot["status"] =
      currentTokens === 0 ? "missing" : missingTokens > 0 ? "thin" : currentTokens > slot.targetMax ? "overfilled" : "covered";
    return {
      id: slot.id,
      label: slot.label,
      targetMin: slot.targetMin,
      targetMax: slot.targetMax,
      required: slot.required,
      currentTokens,
      missingTokens,
      blockIds: slotBlocks.map((block) => block.id),
      replacementPolicy: slot.replacementPolicy,
      freshness: slot.freshness,
      status,
      conflicts: [],
    } satisfies RecipeSlot;
  });

  return {
    id: `${source.id}:recipe`,
    title: `${source.title} warm-start recipe`,
    targetMin: 100_000,
    targetMax: 125_000,
    suggestedTokens: planned.filter((block) => block.includedDefault).reduce((sum, block) => sum + block.tokens, 0),
    blocks: planned,
    slots,
  };
}

function completeAnalysis(
  source: SessionSource,
  chunks: ClassifiedChunk[],
  contextTokens: number,
  modelWindow: number | null,
): SessionAnalysis {
  const proxyTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
  const safeProxy = Math.max(1, proxyTokens);
  const scale = contextTokens / safeProxy;
  const scaledChunks: AnalyzedChunk[] = chunks.map((chunk, index) => {
    const artifactType = chunk.artifactType ?? artifactTypeFor(chunk);
    const lifecycle = chunk.lifecycle ?? lifecycleFor(chunk, artifactType);
    const stability = chunk.stability ?? stabilityFor(chunk, artifactType);
    const repoScope = chunk.repoScope ?? repoScopeFor(source, chunk);
    const tokens = chunk.tokens * scale;
    return {
      ...chunk,
      id: `${source.id}:atom:${index}`,
      sessionId: source.id,
      tokens,
      rawTokenCount: Math.round(chunk.rawTokenCount ?? chunk.tokens),
      excerpt: chunk.excerpt ?? chunk.summary,
      excerptTruncated: Boolean(chunk.excerptTruncated),
      pinned: Boolean(chunk.pinned),
      sourceType: chunk.sourceType ?? "message",
      role: chunk.role ?? null,
      toolName: chunk.toolName ?? null,
      command: chunk.command ?? null,
      lineNumber: chunk.lineNumber ?? null,
      messageIndex: chunk.messageIndex ?? index,
      turnIndex: chunk.turnIndex ?? Math.floor(index / 2),
      contentHash: chunk.contentHash ?? hashText(`${chunk.label}\n${chunk.summary}`),
      fileRefs: chunk.fileRefs ?? [],
      lifecycle,
      artifactType,
      repoScope,
      stability,
    };
  });

  const bucketInsights = buildBucketInsights(scaledChunks, contextTokens);
  const slices = buildContextSlices(source, scaledChunks);
  const contextBlocks = buildContextBlocks(source, bucketInsights, slices, scaledChunks);
  const snapshots = withSnapshotDeltas(
    ANALYSIS_THRESHOLDS.map((threshold) => snapshotAt(scaledChunks, threshold, contextTokens)),
  );
  const atoms: ContextAtom[] = scaledChunks.map((chunk) => ({
    id: chunk.id,
    sessionId: chunk.sessionId,
    bucket: chunk.bucket,
    tokens: Math.round(chunk.tokens),
    rawTokenCount: chunk.rawTokenCount,
    label: chunk.label,
    summary: chunk.summary,
    excerpt: chunk.excerpt,
    excerptTruncated: chunk.excerptTruncated,
    pinned: chunk.pinned,
    sourceType: chunk.sourceType,
    role: chunk.role,
    toolName: chunk.toolName,
    command: chunk.command,
    lineNumber: chunk.lineNumber,
    messageIndex: chunk.messageIndex,
    turnIndex: chunk.turnIndex,
    contentHash: chunk.contentHash,
    fileRefs: chunk.fileRefs,
    lifecycle: chunk.lifecycle,
    artifactType: chunk.artifactType,
    repoScope: chunk.repoScope,
    stability: chunk.stability,
  }));

  return {
    id: source.id,
    project: source.project,
    title: source.title,
    path: source.path,
    source: source.source,
    timeLabel: source.timeLabel,
    summary: source.summary,
    contextTokens: Math.round(contextTokens),
    engineBudget: DEFAULT_ENGINE_BUDGET,
    modelWindow,
    proxyTokens,
    chunkCount: chunks.length,
    atoms,
    slices,
    bucketTotals: allocationsFrom(scaledChunks, contextTokens),
    bucketInsights,
    recipeDraft: buildRecipeDraft(source, contextBlocks),
    snapshots,
    classifierNotes: [
      "Allocations are heuristic proxies from transcript chunks, tool calls, tool output, and token telemetry.",
      "Tool output token counts use harness-reported counts when available; other chunks use character-based token estimates.",
      "Thresholds model pinned policy/task/environment plus recent tail, which is closer to a live context window than raw chronology.",
    ],
    goodContext: GOOD_CONTEXTS[source.id],
  };
}

function parseCodexJsonl(source: SessionSource, jsonl: string): SessionAnalysis {
  const chunks: ClassifiedChunk[] = [];
  const calls = new Map<string, string>();
  let maxContext = 0;
  let maxTotal = 0;
  let modelWindow: number | null = null;

  for (const [lineIndex, line] of jsonl.split("\n").entries()) {
    if (!line.trim()) continue;
    let rec: Record<string, any>;
    try {
      rec = JSON.parse(line) as Record<string, any>;
    } catch {
      continue;
    }
    const payload = rec.payload as Record<string, any> | undefined;
    if (rec.type === "event_msg" && payload?.type === "token_count") {
      const info = payload.info as Record<string, any> | undefined;
      const last = info?.last_token_usage as Record<string, any> | undefined;
      maxContext = Math.max(maxContext, Number(last?.input_tokens ?? 0));
      maxTotal = Math.max(maxTotal, Number(last?.total_tokens ?? 0));
      modelWindow = Number(payload.model_context_window ?? info?.model_context_window ?? modelWindow) || modelWindow;
      continue;
    }
    if (rec.type !== "response_item" || !payload) continue;

    if (payload.type === "message") {
      const text = asText(payload.content);
      const mediaTokens = mediaTokenCount(payload.content);
      if (payload.role === "developer" || payload.role === "system") {
        pushChunk(chunks, "policy", text, null, true, `${payload.role} instructions`, {
          sourceType: "message",
          role: String(payload.role ?? ""),
          lineNumber: lineIndex + 1,
          messageIndex: lineIndex,
          turnIndex: lineIndex,
        });
      } else if (payload.role === "user") {
        pushChunk(chunks, classifyUserText(text), text, null, undefined, "user message", {
          sourceType: "message",
          role: "user",
          lineNumber: lineIndex + 1,
          messageIndex: lineIndex,
          turnIndex: lineIndex,
        });
      } else if (payload.role === "assistant") {
        pushChunk(chunks, classifyAssistantText(text), text, null, false, "assistant message", {
          sourceType: "message",
          role: "assistant",
          lineNumber: lineIndex + 1,
          messageIndex: lineIndex,
          turnIndex: lineIndex,
        });
      }
      if (mediaTokens > 0) {
        pushChunk(chunks, "media", "image attachment", mediaTokens, false, "image attachment", {
          sourceType: "media",
          role: String(payload.role ?? ""),
          lineNumber: lineIndex + 1,
          messageIndex: lineIndex,
          turnIndex: lineIndex,
        });
      }
    } else if (payload.type === "function_call") {
      const callId = String(payload.call_id ?? "");
      const command = parseCommand(payload.arguments);
      if (callId) calls.set(callId, command);
      pushChunk(chunks, "tools", `${payload.name ?? "tool"} ${command}`, null, false, `call · ${payload.name ?? "tool"}`, {
        sourceType: "tool-call",
        toolName: String(payload.name ?? "tool"),
        command,
        lineNumber: lineIndex + 1,
        messageIndex: lineIndex,
        turnIndex: lineIndex,
      });
    } else if (payload.type === "function_call_output") {
      const callId = String(payload.call_id ?? "");
      const output = String(payload.output ?? "");
      const command = calls.get(callId) ?? "";
      pushChunk(
        chunks,
        classifyToolOutput(output, command),
        output,
        originalTokenCount(output),
        false,
        command ? `output · ${command.slice(0, 72)}` : "tool output",
        {
          sourceType: "tool-output",
          command,
          lineNumber: lineIndex + 1,
          messageIndex: lineIndex,
          turnIndex: lineIndex,
        },
      );
    } else if (payload.type === "reasoning") {
      const text = asText(payload.summary);
      pushChunk(chunks, "decisions", text, null, false, "reasoning summary", {
        sourceType: "reasoning",
        role: "assistant",
        lineNumber: lineIndex + 1,
        messageIndex: lineIndex,
        turnIndex: lineIndex,
      });
    }
  }

  const proxyTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
  return completeAnalysis(source, chunks, maxContext || maxTotal || proxyTokens, modelWindow);
}

function parseClaudeJsonl(source: SessionSource, jsonl: string): SessionAnalysis {
  const chunks: ClassifiedChunk[] = [];
  const calls = new Map<string, string>();
  let maxContext = 0;

  for (const [lineIndex, line] of jsonl.split("\n").entries()) {
    if (!line.trim()) continue;
    let rec: Record<string, any>;
    try {
      rec = JSON.parse(line) as Record<string, any>;
    } catch {
      continue;
    }
    const message = rec.message as Record<string, any> | undefined;
    if (rec.type === "assistant" && message?.usage) {
      const usage = message.usage as Record<string, any>;
      maxContext = Math.max(
        maxContext,
        Number(usage.input_tokens ?? 0) +
          Number(usage.cache_creation_input_tokens ?? 0) +
          Number(usage.cache_read_input_tokens ?? 0) +
          Number(usage.output_tokens ?? 0),
      );
    }

    if (rec.type === "assistant" && Array.isArray(message?.content)) {
      for (const part of message.content as Record<string, any>[]) {
        if (part.type === "text") {
          const text = String(part.text ?? "");
          pushChunk(chunks, classifyAssistantText(text), text, null, false, "assistant text", {
            sourceType: "message",
            role: "assistant",
            lineNumber: lineIndex + 1,
            messageIndex: lineIndex,
            turnIndex: lineIndex,
          });
        } else if (part.type === "tool_use") {
          const id = String(part.id ?? "");
          const input = part.input as Record<string, any> | undefined;
          const command = String(input?.command ?? input?.file_path ?? input?.path ?? part.name ?? "");
          if (id) calls.set(id, command);
          pushChunk(chunks, "tools", command, null, false, `tool · ${part.name ?? "tool"}`, {
            sourceType: "tool-call",
            toolName: String(part.name ?? "tool"),
            command,
            lineNumber: lineIndex + 1,
            messageIndex: lineIndex,
            turnIndex: lineIndex,
          });
        }
      }
    } else if (rec.type === "user") {
      const content = message?.content;
      if (typeof content === "string") {
        pushChunk(chunks, classifyUserText(content), content, null, undefined, "user message", {
          sourceType: "message",
          role: "user",
          lineNumber: lineIndex + 1,
          messageIndex: lineIndex,
          turnIndex: lineIndex,
        });
      } else if (Array.isArray(content)) {
        for (const part of content as Record<string, any>[]) {
          if (part.type === "tool_result") {
            const output = String(part.content ?? "");
            const command = calls.get(String(part.tool_use_id ?? "")) ?? "";
            pushChunk(
              chunks,
              classifyToolOutput(output, command),
              output,
              null,
              false,
              command ? `result · ${command.slice(0, 72)}` : "tool result",
              {
                sourceType: "tool-output",
                command,
                lineNumber: lineIndex + 1,
                messageIndex: lineIndex,
                turnIndex: lineIndex,
              },
            );
          } else {
            const text = asText([part]);
            pushChunk(chunks, classifyUserText(text), text, null, undefined, "user content", {
              sourceType: "message",
              role: "user",
              lineNumber: lineIndex + 1,
              messageIndex: lineIndex,
              turnIndex: lineIndex,
            });
          }
        }
      }
    }
  }

  const proxyTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
  return completeAnalysis(source, chunks, maxContext || proxyTokens, 200_000);
}

async function analyzeSessionSource(source: SessionSource): Promise<SessionAnalysis> {
  try {
    const jsonl = await readFile(source.path, "utf8");
    return source.source === "codex"
      ? parseCodexJsonl(source, jsonl)
      : parseClaudeJsonl(source, jsonl);
  } catch {
    return completeAnalysis(
      source,
      [{ bucket: "history", tokens: 1, label: "missing transcript", summary: "Session file could not be read." }],
      1,
      null,
    );
  }
}

function withBucketRecurrence(sessions: SessionAnalysis[]): SessionAnalysis[] {
  const counts = new Map<ContextBucketId, number>();
  const titles = new Map<ContextBucketId, string[]>();
  for (const bucket of BUCKET_ORDER) counts.set(bucket, 0);
  for (const session of sessions) {
    for (const insight of session.bucketInsights) {
      if (insight.percent >= 8) {
        counts.set(insight.bucket, (counts.get(insight.bucket) ?? 0) + 1);
        titles.set(insight.bucket, [...(titles.get(insight.bucket) ?? []), session.title]);
      }
    }
  }
  return sessions.map((session) => ({
    ...session,
    bucketInsights: session.bucketInsights.map((insight) => {
      const count = counts.get(insight.bucket) ?? 0;
      const matchedTitles = titles.get(insight.bucket) ?? [];
      const similarityScore = Math.round((count / Math.max(1, sessions.length)) * 100) / 100;
      const recurrence: RecurrenceSignal = {
        label:
          insight.percent >= 8
            ? `recurs above 8% in ${count}/${sessions.length} sessions`
            : `below 8% in this session; compare before promoting`,
        corpusSize: sessions.length,
        matchedSessions: count,
        similarityScore,
        recurringPatterns: matchedTitles.slice(0, 4),
        novelty: count >= 6 ? "common" : count >= 3 ? "mixed" : "novel",
        reuseCandidate: insight.percent >= 8 && count >= 3 && insight.significance !== "low",
        evidenceRefs: insight.examples.map((example) => example.atomId),
      };
      return {
        ...insight,
        recurrence,
      };
    }),
  })).map((session) => {
    const source = SESSION_SOURCES.find((candidate) => candidate.id === session.id);
    if (!source) return session;
    const blocks = buildContextBlocks(source, session.bucketInsights, session.slices, session.atoms);
    return {
      ...session,
      recipeDraft: buildRecipeDraft(source, blocks),
    };
  });
}

function readBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function extractAssistantText(content: AssistantMessage["content"]): string {
  return content
    .filter((part): part is TextContent => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

async function loadSessionAnalyses(): Promise<SessionAnalysis[]> {
  return withBucketRecurrence(await Promise.all(SESSION_SOURCES.map(analyzeSessionSource)));
}

function allocationLine(snapshot: ThresholdSnapshot): string {
  const get = (bucket: ContextBucketId) =>
    snapshot.allocations.find((allocation) => allocation.bucket === bucket)?.tokens ?? 0;
  const groups = [
    ["project knowledge", get("codebase") + get("policy")],
    ["current task", get("task") + get("decisions") + get("collaboration")],
    ["commands and evidence", get("tools") + get("verification") + get("media")],
    ["setup and runtime", get("environment")],
    ["old conversation", get("history")],
  ] as const;
  return groups
    .map(([label, tokens]) => `${label}: ${Math.round((tokens / Math.max(1, snapshot.coveredTokens)) * 100)}%`)
    .join(", ");
}

function topBucketAllocations(
  allocations: BucketAllocation[],
  count: number,
): BucketAllocation[] {
  return [...allocations].sort((a, b) => b.tokens - a.tokens).slice(0, count);
}

function askFallbackAnswer(
  session: SessionAnalysis,
  snapshot: ThresholdSnapshot,
  question: string,
  citations: BucketExample[],
): string {
  const top = topBucketAllocations(snapshot.allocations, 3)
    .map((allocation) => `${allocation.bucket} ${Math.round(allocation.percent)}%`)
    .join(", ");
  const good = session.goodContext
    ? `${session.goodContext.label}: ${session.goodContext.lesson}`
    : "This session has not been promoted into the good-context cohort yet.";
  const examples = citations
    .slice(0, 3)
    .map((citation) => `${citation.label}: ${citation.summary}`)
    .join(" / ");
  return [
    `Local analysis answer for "${question}".`,
    `${session.title} carries ${Math.round(snapshot.coveredTokens / 1000)}k tokens at this threshold. In normal-dev terms: ${allocationLine(snapshot)}.`,
    `The dominant technical buckets are ${top}. ${good}`,
    examples ? `Useful evidence to inspect: ${examples}` : "There are no strong source examples for this slice yet.",
  ].join("\n\n");
}

function buildAskPrompt(
  session: SessionAnalysis,
  snapshot: ThresholdSnapshot,
  question: string,
  bucket?: ContextBucketId,
): { prompt: string; citations: BucketExample[]; usedAtoms: number } {
  const insights = bucket
    ? session.bucketInsights.filter((insight) => insight.bucket === bucket)
    : topBucketAllocations(snapshot.allocations, 4)
        .map((allocation) => session.bucketInsights.find((insight) => insight.bucket === allocation.bucket))
        .filter((insight): insight is BucketInsight => Boolean(insight));
  const citations = insights.flatMap((insight) => insight.examples.slice(0, 4)).slice(0, 10);
  const atomSet = new Set(snapshot.chunkRefs);
  const slices = session.slices
    .filter((slice) => slice.atomRefs.some((atom) => atomSet.has(atom)))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10);
  const slots = session.recipeDraft.slots
    .map(
      (slot) =>
        `- ${slot.label}: ${slot.status}, ${Math.round(slot.currentTokens / 1000)}k/${Math.round(slot.targetMin / 1000)}-${Math.round(slot.targetMax / 1000)}k`,
    )
    .join("\n");
  const prompt = [
    `Question: ${question}`,
    "",
    `Session: ${session.project} / ${session.title}`,
    `Why this can be a good training-ground context: ${session.goodContext?.reason ?? "not promoted yet"}`,
    `Main lesson: ${session.goodContext?.lesson ?? "inspect before reuse"}`,
    `Caveat: ${session.goodContext?.caveat ?? "unknown"}`,
    `Threshold: ${snapshot.threshold}; covered tokens: ${snapshot.coveredTokens}`,
    `Normal-dev allocation: ${allocationLine(snapshot)}`,
    "",
    "Bucket insights:",
    insights
      .map(
        (insight) =>
          `- ${insight.bucket}: ${Math.round(insight.percent)}%, ${insight.tightness}, ${insight.significance}. ${insight.summary}`,
      )
      .join("\n"),
    "",
    "Recipe slots:",
    slots,
    "",
    "Top slices:",
    slices
      .map(
        (slice) =>
          `- ${slice.title}: ${Math.round(slice.tokens / 1000)}k, ${slice.stability}, ${slice.summary}`,
      )
      .join("\n"),
    "",
    "Representative source atoms:",
    citations
      .map(
        (citation) =>
          `- ${citation.label}${citation.lineNumber ? ` line ${citation.lineNumber}` : ""}: ${citation.summary}`,
      )
      .join("\n"),
    "",
    "Answer like a senior dev explaining context quality to another normal developer. Be direct. Separate what is known from what is inferred.",
  ].join("\n");
  return { prompt, citations, usedAtoms: atomSet.size };
}

async function answerWithModel(prompt: string): Promise<{ answer: string; model: string } | null> {
  const provider = "anthropic";
  const modelId = "claude-sonnet-4-6";
  const apiKey = (await getOAuthApiKey(provider)) ?? getEnvApiKey(provider);
  if (!apiKey) return null;
  try {
    const model = getModel(provider as never, modelId as never);
    const message = await complete(
      model,
      {
        systemPrompt:
          "You are the Contextual analysis console. Explain LLM input context plainly for software developers. Prefer concrete tradeoffs over dashboards. Keep answers under 220 words unless asked for detail.",
        messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
      },
      { apiKey, cacheRetention: "short" },
    );
    return { answer: extractAssistantText(message.content), model: modelId };
  } catch (e) {
    console.warn(`[session-analysis] model answer failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function handleDispatch(req: Connect.IncomingMessage, res: ServerResponse) {
  const body = (await readBody(req)) as DispatchRequest;
  if (!body.threadId || !body.branchId || !body.user || !body.config) {
    return json(res, 400, {
      error: "threadId, branchId, user, config required",
    });
  }
  const backend = BACKENDS[body.config.backend];
  if (!backend) {
    return json(res, 400, { error: `unknown backend: ${body.config.backend}` });
  }
  try {
    const result = await backend.dispatch(body);
    json(res, 200, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${body.config.backend}] dispatch error: ${msg}`);
    json(res, 500, { error: msg });
  }
}

async function handleBranch(req: Connect.IncomingMessage, res: ServerResponse) {
  const body = (await readBody(req)) as BranchRequest;
  if (!body.threadId || !body.fromBranchId || !body.newBranchId || !body.config) {
    return json(res, 400, {
      error: "threadId, fromBranchId, newBranchId, config required",
    });
  }
  const backend = BACKENDS[body.config.backend];
  if (!backend) {
    return json(res, 400, { error: `unknown backend: ${body.config.backend}` });
  }
  if (!backend.branch) {
    return json(res, 200, { pending: false });
  }
  try {
    const result = await backend.branch(body);
    json(res, 200, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    json(res, 500, { error: msg });
  }
}

async function handleTree(_req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    json(res, 200, await gatherTree());
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleWorkspace(req: Connect.IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const threadId = url.searchParams.get("threadId");
  if (!threadId) return json(res, 400, { error: "threadId required" });
  try {
    json(res, 200, await gatherWorkspace(threadId));
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleOAuthStatus(_req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    json(res, 200, await authStatus());
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleOAuthLogin(req: Connect.IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const provider = url.searchParams.get("provider");
  if (!provider) return json(res, 400, { error: "provider required" });
  try {
    await loginProvider(provider);
    json(res, 200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[oauth] login error: ${msg}`);
    json(res, 500, { error: msg });
  }
}

async function handleSessionAnalysis(_req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    const sessions = await loadSessionAnalyses();
    const body: SessionAnalysisResponse = {
      generatedAt: new Date().toISOString(),
      thresholds: ANALYSIS_THRESHOLDS,
      sessions,
    };
    json(res, 200, body);
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleSessionAnalysisAsk(req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    const body = (await readBody(req)) as SessionAnalysisAskRequest;
    if (!body.sessionId || !body.question?.trim()) {
      return json(res, 400, { error: "sessionId and question required" });
    }
    const sessions = await loadSessionAnalyses();
    const session = sessions.find((candidate) => candidate.id === body.sessionId);
    if (!session) return json(res, 404, { error: `unknown session: ${body.sessionId}` });
    const snapshot =
      session.snapshots.find((candidate) => candidate.threshold === body.threshold) ??
      session.snapshots[session.snapshots.length - 1];
    if (!snapshot) return json(res, 400, { error: "session has no snapshots" });
    const { prompt, citations, usedAtoms } = buildAskPrompt(
      session,
      snapshot,
      body.question.trim(),
      body.bucket,
    );
    const modelAnswer = await answerWithModel(prompt);
    const response: SessionAnalysisAskResponse = {
      answer: modelAnswer?.answer || askFallbackAnswer(session, snapshot, body.question.trim(), citations),
      mode: modelAnswer ? "llm" : "heuristic",
      model: modelAnswer?.model,
      citations,
      usedAtoms,
    };
    json(res, 200, response);
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

const handler: Connect.NextHandleFunction = (req, res, next) => {
  const url = (req.url ?? "").split("?")[0];
  if (req.method === "POST" && url === "/api/dispatch") {
    void handleDispatch(req, res);
    return;
  }
  if (req.method === "POST" && url === "/api/branch") {
    void handleBranch(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/tree") {
    void handleTree(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/workspace") {
    void handleWorkspace(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/oauth/status") {
    void handleOAuthStatus(req, res);
    return;
  }
  if (req.method === "POST" && url === "/api/oauth/login") {
    void handleOAuthLogin(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/session-analysis") {
    void handleSessionAnalysis(req, res);
    return;
  }
  if (req.method === "POST" && url === "/api/session-analysis/ask") {
    void handleSessionAnalysisAsk(req, res);
    return;
  }
  next();
};

export function backendsPlugin(): Plugin {
  return {
    name: "vite-plugin-backends",
    configureServer(server) {
      ensureBackendDirs();
      server.middlewares.use(handler);
    },
  };
}
