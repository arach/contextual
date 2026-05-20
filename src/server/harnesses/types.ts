export type HarnessId = "codex" | "claude" | "pi";

export type ManifestTruth = "logged" | "reconstructed" | "inferred" | "unavailable";

export type ManifestPartKind =
  | "system"
  | "developer"
  | "user"
  | "assistant"
  | "tool-call"
  | "tool-result"
  | "reasoning"
  | "sidecar"
  | "attachment"
  | "compact-summary"
  | "workspace"
  | "memory";

export type ManifestTransfer = "direct" | "transform" | "harness-native" | "drop" | "manual";

export interface HarnessSessionRef {
  key: string;
  harness: HarnessId;
  nativeSessionId?: string;
  path: string;
  cwd?: string;
  project?: string;
  title: string;
  summary: string;
  parentSessionKey?: string;
  observedAt: string;
  mtimeMs: number;
  sizeBytes: number;
}

export interface SourceRef {
  kind: "jsonl" | "sidecar" | "derived";
  path?: string;
  line?: number;
  byteOffset?: number;
  recordType?: string;
  fieldPath?: string;
  hash?: string;
}

export interface AtRestLine<TNative = unknown> {
  sessionKey: string;
  line: number;
  byteOffset?: number;
  recordType: string;
  timestamp?: string;
  role?: "system" | "developer" | "user" | "assistant" | "tool" | "unknown";
  turnId?: string;
  native: TNative;
  raw?: string;
  source: SourceRef;
}

export interface AtRestReadOptions {
  fromLine?: number;
  limit?: number;
  includeRaw?: boolean;
}

export interface AtRestReadResponse {
  session: HarnessSessionRef;
  fromLine: number;
  limit: number;
  totalLines: number;
  nextFromLine: number | null;
  lines: AtRestLine[];
}

export interface SidecarOptions {
  includeContent?: boolean;
}

export interface SidecarFile {
  id: string;
  kind:
    | "agents"
    | "claude-md"
    | "skill"
    | "workspace-file"
    | "manifest"
    | "attachment"
    | "unknown";
  path: string;
  bytes: number;
  mtimeMs: number;
  hash: string;
  includedByDefault?: boolean;
  content?: string;
}

export interface CompactBoundary {
  source: SourceRef;
  preTokens?: number;
  postTokens?: number;
  summary?: string;
}

export interface TokenBudgetMetadata {
  model?: string;
  modelWindow?: number | null;
  loggedInputTokens?: number;
  loggedOutputTokens?: number;
  loggedTotalTokens?: number;
  estimatedInputTokens?: number;
  estimateSource?: "harness" | "model-tokenizer" | "heuristic";
}

export interface TurnRecord {
  id: string;
  sessionKey: string;
  index: number;
  userLine?: number;
  assistantLine?: number;
  startedAt?: string;
  completedAt?: string;
  model?: string;
  cwd?: string;
  title?: string;
  tokenCounts?: TokenBudgetMetadata;
  compactBoundary?: CompactBoundary;
  nativeRefs: SourceRef[];
  warnings?: string[];
}

export interface ManifestPart {
  id: string;
  order: number;
  kind: ManifestPartKind;
  role?: "system" | "developer" | "user" | "assistant" | "tool";
  title?: string;
  content?: string;
  contentRef?: SourceRef;
  tokens?: number;
  truth: ManifestTruth;
  sourceRefs: SourceRef[];
  transfer: ManifestTransfer;
  native?: unknown;
}

export interface TurnReadyManifest {
  id: string;
  session: HarnessSessionRef;
  turn: TurnRecord;
  harness: HarnessId;
  model?: string;
  cwd?: string;
  generatedAt: string;
  adapterVersion: string;
  assembly: {
    status:
      | "actual-payload-logged"
      | "turn-context-logged"
      | "reconstructed"
      | "best-effort"
      | "partial";
    confidence: "high" | "medium" | "low";
  };
  parts: ManifestPart[];
  tokenBudget: TokenBudgetMetadata;
  sidecars: SidecarFile[];
  warnings: string[];
  native?: unknown;
}

export type CatalogOptions = HarnessCatalogOptions;

export interface HarnessCatalogOptions {
  harness?: HarnessId;
  cwd?: string;
  q?: string;
  limit?: number;
  maxAgeMs?: number;
}

export interface HarnessCatalogResponse {
  generatedAt: string;
  total: number;
  sessions: HarnessSessionRef[];
}

export interface HarnessCapabilities {
  hasLoggedTurnContext: boolean;
  hasCompactionMarkers: boolean;
  hasWorkspaceSidecars: boolean;
  canFork: boolean;
  canReplayPayload: boolean;
}

export interface HarnessAdapter {
  id: HarnessId;
  version: string;
  capabilities: HarnessCapabilities;
  discover(opts?: HarnessCatalogOptions): Promise<HarnessSessionRef[]>;
  open(ref: HarnessSessionRef): Promise<HarnessSessionRef>;
  readAtRest(ref: HarnessSessionRef, opts?: AtRestReadOptions): Promise<AtRestReadResponse>;
  listSidecars(ref: HarnessSessionRef, opts?: SidecarOptions): Promise<SidecarFile[]>;
  listTurns(ref: HarnessSessionRef): Promise<TurnRecord[]>;
  buildManifest(
    ref: HarnessSessionRef,
    turn: "latest" | string | number,
    opts?: { includeSidecarContent?: boolean },
  ): Promise<TurnReadyManifest>;
}

export interface ManifestDiff {
  fromManifestId: string;
  toManifestId: string;
  added: ManifestPart[];
  removed: ManifestPart[];
  changed: Array<{ from: ManifestPart; to: ManifestPart }>;
  tokenDelta: number;
  nonTransferable: ManifestPart[];
}

export interface HotSwapTarget {
  harness: HarnessId;
  model?: string;
  cwd?: string;
  mode: "replay" | "fork" | "summarize-and-fork";
}

export interface HotSwapPlan {
  sourceManifestId: string;
  target: HotSwapTarget;
  transferableParts: ManifestPart[];
  transformedParts: Array<{ fromPartId: string; toKind: ManifestPartKind; reason: string }>;
  droppedParts: Array<{ partId: string; reason: string }>;
  warnings: string[];
  replayBundlePath?: string;
}
