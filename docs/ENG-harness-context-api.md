# ENG: Harness Context API

Status: draft implementation slice 0.1  
Owner: Contextual  
Scope: additive server API; no `SessionAnalysis`/atom refactor in this phase

## Problem

Contextual currently treats agent sessions as a pile of transcript chunks and then projects them into atoms, buckets, slices, and recipe drafts. That works for analysis, but it is the wrong foundation for three newer product goals:

1. Show the real at-rest state: append-only JSONL logs plus sidecar files.
2. Reconstruct turn-ready context: the best answer to “what would this harness assemble and send with the latest user message?”
3. Support hot swaps: move a session from Codex, Claude Code, or Pi into another harness/model while preserving as much context as possible.

The current implementation collapses Codex and Claude logs directly into `SessionAnalysis` in `src/server/session-analysis/index.ts`. The “raw” UI tree still uses Contextual atoms rather than native records. Pi already has a cleaner at-rest model under `~/.contextual`, but it is wired through the backend implementation, not through a reusable context API.

## Goals

- Add a harness-neutral server kernel under `src/server/harnesses`.
- Preserve native JSONL records and sidecars as first-class at-rest data.
- Normalize only stable boundaries: sessions, lines, turns, sidecars, manifest parts, token metadata.
- Build turn-ready manifests with explicit truth labels: `logged`, `reconstructed`, `inferred`, `unavailable`.
- Discover Codex, Claude Code, and Pi sessions from local disk.
- Provide REST routes for catalog, session open, at-rest read, turns, and manifest.
- Keep the existing `SessionAnalysis` atom model unchanged in the first slice.

## Non-goals

- Do not rewrite the analysis UI yet.
- Do not delete the old session parsers yet.
- Do not claim Claude Code exact prompt reconstruction when it is not logged.
- Do not create or launch new harness sessions in this slice.
- Do not implement hot swap execution yet; only define the data foundation.

## Architecture

```txt
app/api/harnesses/*
  -> src/server/harnesses/registry.ts
      -> adapters/codex.ts
      -> adapters/claude.ts
      -> adapters/pi.ts
          -> at-rest.ts
          -> turns.ts
          -> manifest.ts
```

### Layer 1: at rest

This layer answers “what exists on disk?”

At-rest sources:

- Codex: `~/.codex/sessions/.../rollout-*.jsonl`
- Claude Code: `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`
- Pi: `~/.contextual/sessions/*.jsonl`, `~/.contextual/manifest.json`, `~/.contextual/workspaces/<id>/AGENTS.md`, `.pi/skills/*.md`

At-rest rows preserve the native record under `native`. Contextual adds only an envelope: line number, byte offset, record type, timestamp, role, source ref.

### Layer 2: turns

This layer identifies user-turn boundaries without pretending those boundaries are the full prompt.

Harness rules:

- Codex: `turn_context` starts the strongest turn boundary. User `response_item` messages fill missing boundaries for older logs.
- Claude Code: user records start turns, except `tool_result`-only user records, which belong to the active assistant/tool turn. `system` compact boundaries decorate adjacent turns.
- Pi: `message.role === "user"` starts a turn. `model_change` decorates following turns.

### Layer 3: turn-ready manifest

This layer builds a best-effort ordered manifest of what the model likely saw for a turn.

A manifest is not a Contextual bucket recipe. It is an ordered list of policy, sidecar, transcript, tool, attachment, and compaction parts with provenance.

Assembly confidence is harness-specific:

- Codex with `turn_context`: high, `turn-context-logged`.
- Pi today: high-ish reconstruction, because Contextual owns the workspace materialization.
- Claude Code: best-effort, because `last-prompt` is not the full prompt and hidden Claude Code system/tool prompts are not fully persisted.

## Core types

The first implementation defines these in `src/server/harnesses/types.ts`:

```ts
type HarnessId = "codex" | "claude" | "pi";
type ManifestTruth = "logged" | "reconstructed" | "inferred" | "unavailable";

interface HarnessSessionRef {
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

interface AtRestLine<TNative = unknown> {
  sessionKey: string;
  line: number;
  byteOffset?: number;
  recordType: string;
  timestamp?: string;
  role?: "system" | "developer" | "user" | "assistant" | "tool" | "unknown";
  native: TNative;
  raw?: string;
  source: SourceRef;
}

interface TurnRecord {
  id: string;
  sessionKey: string;
  index: number;
  userLine?: number;
  assistantLine?: number;
  model?: string;
  cwd?: string;
  tokenCounts?: TokenBudgetMetadata;
  compactBoundary?: CompactBoundary;
  nativeRefs: SourceRef[];
  warnings?: string[];
}

interface TurnReadyManifest {
  id: string;
  session: HarnessSessionRef;
  turn: TurnRecord;
  harness: HarnessId;
  model?: string;
  cwd?: string;
  adapterVersion: string;
  assembly: {
    status: "actual-payload-logged" | "turn-context-logged" | "reconstructed" | "best-effort" | "partial";
    confidence: "high" | "medium" | "low";
  };
  parts: ManifestPart[];
  tokenBudget: TokenBudgetMetadata;
  sidecars: SidecarFile[];
  warnings: string[];
}
```

## Adapter contract

Every adapter implements:

```ts
interface HarnessAdapter {
  id: HarnessId;
  version: string;
  capabilities: HarnessCapabilities;
  discover(opts?: HarnessCatalogOptions): Promise<HarnessSessionRef[]>;
  open(ref: HarnessSessionRef): Promise<HarnessSessionRef>;
  readAtRest(ref: HarnessSessionRef, opts?: AtRestReadOptions): Promise<AtRestReadResponse>;
  listSidecars(ref: HarnessSessionRef, opts?: SidecarOptions): Promise<SidecarFile[]>;
  listTurns(ref: HarnessSessionRef): Promise<TurnRecord[]>;
  buildManifest(ref: HarnessSessionRef, turn: "latest" | string | number): Promise<TurnReadyManifest>;
}
```

Adapters own harness-specific semantics. The kernel owns shared shapes and routing.

## REST API

Implemented first slice:

```txt
GET /api/harnesses/catalog?harness=codex|claude|pi&q=&cwd=&limit=
GET /api/harnesses/sessions/:sessionKey
GET /api/harnesses/sessions/:sessionKey/at-rest?fromLine=&limit=&includeRaw=false
GET /api/harnesses/sessions/:sessionKey/turns
GET /api/harnesses/sessions/:sessionKey/manifest?turn=latest
```

Future routes:

```txt
GET  /api/harnesses/sessions/:sessionKey/sidecars?includeContent=false
GET  /api/harnesses/sessions/:sessionKey/token-budget?turn=latest
POST /api/harnesses/manifest/diff
POST /api/harnesses/hot-swap/plan
POST /api/harnesses/hot-swap/execute
```

## Normalization boundaries

Normalize:

- session identity
- file path / mtime / size
- JSONL line number and byte offset
- record type
- role
- user-turn boundaries
- sidecar identity and hash
- manifest part order/kind/truth/transfer metadata

Preserve native:

- full JSONL record
- harness record type
- tool-call shape
- reasoning records
- compaction marker payload
- permission-mode / sandbox / queue-operation payloads
- Pi workspace materialization files

Do not normalize yet:

- tool schemas
- exact hidden system prompts
- cached-token semantics
- model-specific tokenization beyond logged totals and heuristic estimates

## Per-harness notes

### Codex

Codex is the best ground-truth source because it logs `turn_context`. The manifest builder should prefer the latest `turn_context` before the target user line and mark it `truth: "logged"`.

Known Codex record types:

- `session_meta`
- `turn_context`
- `response_item`
- `event_msg`

First implementation:

- Discovers under `~/.codex/sessions`.
- Uses `turn_context` plus user messages for turns.
- Reads `event_msg.token_count` into token metadata.
- Builds manifest from session metadata, latest turn context, and transcript records up to the target user line.

### Claude Code

Claude Code must be labeled honestly. `last-prompt` is only latest user text, not full assembled context.

Known record types:

- `user`
- `assistant`
- `system` including `compact_boundary`
- `attachment`
- `file-history-snapshot`
- `permission-mode`
- `queue-operation`
- `last-prompt`

First implementation:

- Discovers under `~/.claude/projects`.
- Decodes the encoded cwd from the project directory when possible.
- Treats `tool_result`-only user records as tool results, not new turns.
- Marks manifest assembly `best-effort`.
- Adds warnings that full prompt assembly is not logged.

### Pi

Pi is the cleanest path for future exactness because Contextual owns the workspace materialization.

At rest:

- JSONL session header: `{ type: "session", id, cwd, parentSession? }`
- Message records: `{ type: "message", message: { role, content } }`
- `~/.contextual/manifest.json`
- workspace `AGENTS.md` and `.pi/skills/*.md`

First implementation:

- Discovers under `~/.contextual/sessions`.
- Finds branch/workspace mapping through `manifest.json`.
- Exposes workspace markdown files as sidecars.
- Builds a high-confidence reconstructed manifest.

Recommended next Pi improvement:

- Log a `dispatch_context` record before every model dispatch. That gives Pi a Codex-like turn-context anchor.

## Caching plan

This first slice reads from disk directly. The next slice should add caches:

```ts
catalog: `${harness}:${root}:${adapterVersion}`
atRestIndex: `${harness}:${path}:${mtimeMs}:${size}:${adapterVersion}`
manifest: `${sessionKey}:${turnId}:${logHash}:${sidecarHash}:${adapterVersion}`
```

Cache only indexes and manifests with provenance. Never cache turn-ready context without sidecar hashes and adapter version.

## Hot-swap implications

Hot swaps should use `TurnReadyManifest`, not atoms.

Directly transferable:

- user messages
- assistant messages
- explicit tool results as evidence
- compact summaries
- AGENTS/CLAUDE/skill sidecar text
- cwd/project hints

Transformable:

- developer/system instructions
- tool-call records
- Pi workspace files into another harness sidecar format
- Claude compaction marker into a summary part

Harness-native or dropped:

- Codex reasoning records
- Claude hidden prompt/tool schema state
- Claude permission/queue state
- cached-token state
- native tool IDs
- sandbox/approval modes that do not map between harnesses

Future hot-swap flow:

1. Build source `TurnReadyManifest`.
2. Classify each part as `direct`, `transform`, `harness-native`, `drop`, or `manual`.
3. Write a replay bundle under `~/.contextual/replays/<id>`.
4. Ask target adapter to create a native fork/workspace.
5. Label resulting session as “replayed/forked from manifest,” not identical continuation.

## Migration plan

### Milestone 1: additive kernel

- Add harness types, adapters, registry, and REST routes.
- Validate `bun run typecheck`.
- Do not refactor `SessionAnalysis`.

### Milestone 2: UI read paths

- Add “At rest” tab backed by `/api/harnesses/sessions/:key/at-rest`.
- Add “Turns” tab backed by `/turns`.
- Add “Turn-ready” tab backed by `/manifest`.
- Rename current raw view to “Contextual transcript” if it still uses atoms.

### Milestone 3: parser migration

- Make `src/server/session-analysis` consume `AtRestLine[]` and `TurnRecord[]`.
- Remove duplicate JSONL walk/parsing logic.
- Add `source: "pi"` to `SessionAnalysis` only after the Pi adapter is stable.

### Milestone 4: hot-swap plan

- Implement manifest diff.
- Implement hot-swap plan route.
- Prototype Codex -> Pi and Pi -> Codex first.
- Keep Claude Code hot swaps best-effort until exact prompt gaps are resolved.

## Risks

- Claude full prompt assembly is not on disk.
- Sidecar discovery rules are harness-versioned and can drift.
- Raw sidecar content may contain secrets; UI should default to metadata unless user expands content.
- Large JSONL files need line-offset caching before deep UI use.
- Turn boundary detection can be wrong for older or changed harness schemas.
- Token counts may be logged at response granularity, not manifest-part granularity.

## Acceptance criteria for this slice

- Catalog returns Codex, Claude, and Pi sessions when they exist locally.
- At-rest route returns paginated native JSONL envelopes.
- Turns route returns sensible turn boundaries for each harness.
- Manifest route returns a latest-turn manifest with truth/confidence labels.
- Existing session-analysis routes continue to work.
- `bun run typecheck` passes.
