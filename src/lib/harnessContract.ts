/**
 * Harness Context API — shared contract (v0.1)
 *
 * Source of truth for wire types between:
 * - Server: src/server/harnesses/*  (Codex agent owns)
 * - Client: Explore UI             (Claude agent owns)
 *
 * Do not drift: update this file + docs/HARNESS-CONTRACT.md together.
 */

export const HARNESS_CONTRACT_VERSION = "0.1.0";

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

export type ExploreContextMode = "at-rest" | "turn-ready" | "contextual";

/** Opaque session id for REST paths. Encode with encodeURIComponent. */
export type HarnessSessionKey = string;

export interface HarnessSessionRef {
  key: HarnessSessionKey;
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

export interface AtRestLine {
  sessionKey: HarnessSessionKey;
  line: number;
  byteOffset?: number;
  recordType: string;
  timestamp?: string;
  role?: "system" | "developer" | "user" | "assistant" | "tool" | "unknown";
  turnId?: string;
  native: unknown;
  raw?: string;
  source: SourceRef;
}

export interface AtRestReadResponse {
  session: HarnessSessionRef;
  fromLine: number;
  limit: number;
  totalLines: number;
  nextFromLine: number | null;
  lines: AtRestLine[];
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
  sessionKey: HarnessSessionKey;
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

export interface HarnessCatalogResponse {
  generatedAt: string;
  total: number;
  sessions: HarnessSessionRef[];
}

export interface HarnessTurnsResponse {
  session: HarnessSessionRef;
  turns: TurnRecord[];
}

export interface HarnessSidecarsResponse {
  session: HarnessSessionRef;
  sidecars: SidecarFile[];
}

export interface HarnessApiError {
  error: string;
}

// --- REST path helpers (client + doc reference) ---

export const HARNESS_API = {
  catalog: "/api/harnesses/catalog",
  session: (key: HarnessSessionKey) =>
    `/api/harnesses/sessions/${encodeURIComponent(key)}`,
  atRest: (key: HarnessSessionKey, opts?: { fromLine?: number; limit?: number; includeRaw?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.fromLine != null) params.set("fromLine", String(opts.fromLine));
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.includeRaw) params.set("includeRaw", "true");
    const q = params.toString();
    return `/api/harnesses/sessions/${encodeURIComponent(key)}/at-rest${q ? `?${q}` : ""}`;
  },
  turns: (key: HarnessSessionKey) =>
    `/api/harnesses/sessions/${encodeURIComponent(key)}/turns`,
  manifest: (key: HarnessSessionKey, turn: "latest" | string | number = "latest") =>
    `/api/harnesses/sessions/${encodeURIComponent(key)}/manifest?turn=${encodeURIComponent(String(turn))}`,
  sidecars: (key: HarnessSessionKey, includeContent = false) =>
    `/api/harnesses/sessions/${encodeURIComponent(key)}/sidecars${includeContent ? "?includeContent=true" : ""}`,
} as const;

async function readJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body: unknown = await res.json();
  if (!res.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as HarnessApiError).error === "string"
        ? (body as HarnessApiError).error
        : res.statusText;
    throw new Error(message);
  }
  return body as T;
}

export async function fetchHarnessCatalog(opts?: {
  harness?: HarnessId;
  cwd?: string;
  q?: string;
  limit?: number;
}): Promise<HarnessCatalogResponse> {
  const params = new URLSearchParams();
  if (opts?.harness) params.set("harness", opts.harness);
  if (opts?.cwd) params.set("cwd", opts.cwd);
  if (opts?.q) params.set("q", opts.q);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const q = params.toString();
  return readJson<HarnessCatalogResponse>(`${HARNESS_API.catalog}${q ? `?${q}` : ""}`);
}

export async function resolveHarnessSessionKey(sessionPath: string): Promise<HarnessSessionKey | null> {
  const catalog = await fetchHarnessCatalog({ limit: 1500 });
  return catalog.sessions.find((s) => s.path === sessionPath)?.key ?? null;
}

export async function fetchHarnessAtRest(
  key: HarnessSessionKey,
  opts?: { fromLine?: number; limit?: number; includeRaw?: boolean },
): Promise<AtRestReadResponse> {
  return readJson<AtRestReadResponse>(HARNESS_API.atRest(key, opts));
}

export async function fetchHarnessTurns(key: HarnessSessionKey): Promise<HarnessTurnsResponse> {
  return readJson<HarnessTurnsResponse>(HARNESS_API.turns(key));
}

export async function fetchHarnessManifest(
  key: HarnessSessionKey,
  turn: "latest" | string | number = "latest",
): Promise<TurnReadyManifest> {
  return readJson<TurnReadyManifest>(HARNESS_API.manifest(key, turn));
}

export async function fetchHarnessSidecars(
  key: HarnessSessionKey,
  includeContent = false,
): Promise<HarnessSidecarsResponse> {
  return readJson<HarnessSidecarsResponse>(HARNESS_API.sidecars(key, includeContent));
}
