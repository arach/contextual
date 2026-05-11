# CTX-001 — Add `@earendil-works/pi-ai` as a second backend

**Status:** Draft v2 — supersedes v1 (`CTX-001-claude-backend.md`), incorporates @openscout#codex review feedback
**Owner:** @arach
**Date:** 2026-05-11

## Changelog vs v1

- **Dropped the `claude` CLI subprocess plan entirely.** Replaced with in-process pi-ai (`@earendil-works/pi-ai@^0.74.0`) — a unified multi-provider LLM API by the same authors as pi-coding-agent.
- **Stateless by construction.** Resolves codex's main catch — v1 had an architectural leak where reusing `claude --session-id` would let the backend "remember" content Contextual considered evicted from Soft. pi-ai has no session concept, so this falls out: every dispatch is a fresh `(systemPrompt, messages, tools)` snapshot.
- **Contextual owns the branch/tree manifest.** Pi has a real native tree (parentId chains + `parentSession` headers); claude doesn't and isn't building one. The abstraction lives above the backends — our manifest is canonical, pi mirrors to its native sessions, pi-ai backend just dispatches.
- **OAuth + API key both supported** out of the box via pi-ai's `oauth` module. Users with Claude Pro/Max don't have to burn metered API credits.
- **N≥3 providers on day one.** Anthropic, OpenAI, Google all exposed through one interface — real pressure test of the UI vocabulary.

## TL;DR

Add a second backend, `PiAiBackend`, that runs in-process via `@earendil-works/pi-ai`. No subprocess, no CLI flag wrestling, both subscription-OAuth and API-key auth supported. The existing pi-coding-agent CLI backend stays (it's the "harness with a native session model"); pi-ai becomes the "harness Contextual drives statelessly." Contextual's own manifest is the canonical tree; backends are dumb dispatch targets.

## Why pi-ai (and not the claude CLI)

After studying both, the claude CLI is the wrong abstraction for our use case:

- **No local session graph.** `--fork-session` (recently renamed to `/branch`) is a pure copy with no parent pointer. The `--resume` picker is a flat cwd-filtered list. claude-code's CHANGELOG signal (40+ recent entries) is on subagents + Managed Agents + Memory Stores — all server-side. They're not building toward local tree ergonomics.
- **Subprocess complexity** for no win: `--bare` flag wrestling, `ANTHROPIC_API_KEY` lifecycle (codex's catch: env at server start misses rotation), stdio handling, SIGINT-then-kill timing, recursive-claude weirdness when Contextual is itself launched from a Claude Code session.
- **Single vendor.** Adding OpenAI or Google later would mean another subprocess wrapper for a different CLI.

pi-ai solves all of this with a small in-process dependency:

```ts
import { streamAnthropic } from "@earendil-works/pi-ai/anthropic";
import { getModel } from "@earendil-works/pi-ai";

const model = getModel("anthropic", "claude-sonnet-4-6");
const events = streamAnthropic(model, { systemPrompt, messages, tools }, { apiKey });
```

The `Context` shape (`{ systemPrompt?, messages[], tools? }`) is exactly Contextual's Fixed-zone → systemPrompt + Soft-zone → messages mapping. The `Usage` struct normalizes `input / output / cacheRead / cacheWrite` tokens *and* costs across providers, which gives us the cost-telemetry chip for free.

### Auth: both paths supported

pi-ai's `oauth` submodule (per its own docstring) handles login, token refresh, and credential storage for:

- **Anthropic (Claude Pro/Max)** — same OAuth flow the `claude` CLI uses, just in-process
- GitHub Copilot
- Google Cloud Code Assist (Gemini CLI)
- Antigravity (Gemini 3, Claude, GPT-OSS via Google Cloud)
- OpenAI Codex

Plus standard API-key auth via env for everyone. We'll expose this as a per-thread setting:

```ts
type Auth =
  | { mode: "api-key"; secretKey: string }    // resolved via `secret get`
  | { mode: "oauth"; providerId: string };    // credentials in ~/.contextual/oauth.json
```

For API-key mode, the dev server inherits env from `secret run -- bun dev` (codex's correction — don't `secret get` once at startup, key rotation won't pick up).

## Backend interface

```ts
// src/lib/backends/types.ts
export interface Backend {
  id: BackendId;                   // "pi-coding-agent" | "pi-ai"
  label: string;
  capabilities: BackendCapabilities;
  dispatch(req: DispatchRequest): Promise<DispatchResult>;
}

export interface BackendCapabilities {
  /** Has a native on-disk session/tree model we mirror to. */
  hasNativeSessions: boolean;       // pi-coding-agent: true, pi-ai: false
  /** Supports OAuth-based subscription auth in addition to API key. */
  hasOAuth: boolean;                // pi-coding-agent: handled by pi itself, pi-ai: true
  /** Multi-provider — exposes a model picker. */
  hasModelPicker: boolean;          // pi-coding-agent: limited, pi-ai: true
  /** Streaming responses available. */
  hasStreaming: boolean;            // pi-coding-agent: text, pi-ai: structured events
  providers?: ProviderId[];         // pi-ai only
}

export interface DispatchRequest {
  threadId: string;
  branchId: string;
  fixed: ContextModule[];           // Fixed zone — pinned-every-call
  soft: SoftItem[];                  // Soft zone — already evicted/budgeted by app
  task?: ThreadTask;
  user: string;
  /** Per-thread backend config; persisted in thread state. */
  config: BackendConfig;
}

export type BackendConfig =
  | { backend: "pi-coding-agent"; model?: string; provider?: string }
  | { backend: "pi-ai"; provider: ProviderId; model: string; auth: Auth };

export interface DispatchResult {
  reply: string;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    costUsd?: number;
  };
  /** Backend-native session pointer (pi-coding-agent only). */
  sessionPath?: string;
  forkedFrom?: string;
}
```

## Contextual-owned tree (resolves codex catch #1)

Our existing `Thread.branches[]` becomes the canonical tree model. New schema:

```ts
interface Branch {
  id: string;
  parentBranchId: string | null;
  createdAt: number;
  /** Backend-native continuation pointer if applicable. */
  backendRef?: {
    backend: "pi-coding-agent";
    sessionPath: string;          // pi JSONL file
  } | {
    backend: "pi-ai";
    // No backendRef needed — pi-ai is stateless, history rebuilt from
    // Contextual's SoftItem store each dispatch.
  };
}
```

- **`pi-coding-agent` backend:** dispatches map to a pi session file. Fork via pi's native `--fork`. We read pi's `parentSession` field to corroborate our manifest but our manifest wins.
- **`pi-ai` backend:** each dispatch is a one-shot `streamAnthropic(...)` (or whichever provider). The Soft window we send is exactly what the user sees in the Rack — no hidden history. This is the "statelessness as a feature" principle in its pure form.
- **Branch UI:** SessionTree reads from `Thread.branches[]`, not from disk. Identical behavior across backends. Per-row "view native session" link is enabled only when `backendRef` exists.

## Soft → messages mapping (pi-ai backend)

Following codex's recommendation (replay roles, don't collapse into a blob):

- **`turn` soft items** → replay as alternating `{ role: "user", content }` and `{ role: "assistant", content }` in `messages[]`
- **`summary` soft items** → injected as a synthetic preamble at the top of `messages[]`: `{ role: "user", content: "Earlier in this branch: …" }`
- **`tool` soft items** → summarized into the preamble as notes (not fake assistant turns — codex's call)
- **`task`** → prepended to `systemPrompt`
- **Fixed modules of `kind: "rules"`** → concatenated into `systemPrompt`, with `cache_control: ephemeral` markers so the prefix is cached across dispatches in the same 5-min window
- **Fixed modules of `kind: "doc" | "log"`** → for pi-ai we send the content directly in the system prompt (no read-tool needed; we control what's in context). For pi-coding-agent we keep the existing workspace-file + `read` tool flow.

## Server-side shape

Vite plugin gains a backend-aware dispatch router:

```
POST /api/dispatch     body: { threadId, branchId, config, fixed, soft, task, user }
POST /api/branch       body: { threadId, fromBranch, newBranch, config }
GET  /api/tree         (Contextual's manifest, not backend-specific)
GET  /api/workspace    ?backend=pi-coding-agent&threadId=…   (pi-only)
POST /api/oauth/login  ?providerId=anthropic                  (pi-ai only)
GET  /api/models       ?backend=pi-ai                         (lists from pi-ai registry)
```

`backends/pi-coding-agent.ts` — existing logic, lightly reorganized.
`backends/pi-ai.ts` — new; imports from `@earendil-works/pi-ai`, dispatches in-process.

## UI changes

- **Top bar:** new backend chip next to the session/designer mode switch:
  `[ pi-coding-agent · sessions ▾ ]` or `[ anthropic · claude-sonnet-4-6 ▾ ]`
  Click reveals a backend + provider + model picker.
- **WorkspaceBadge:** shows only when `backend === "pi-coding-agent"` (workspace materialization is pi-specific).
- **SessionTree:** always visible — reads from Contextual's manifest. Native-session links only render for branches with a `backendRef`.
- **Cost chip:** new, near the WorkspaceBadge slot. Shows `usage.costUsd` and `cacheRead` from last dispatch.
- **Auth panel** (Settings or first-use prompt): for pi-ai backend, choose between "use ANTHROPIC_API_KEY from environment" or "sign in with Claude Pro/Max" (opens OAuth browser flow).

## Spawning hygiene (pi-coding-agent backend — unchanged)

Carrying over codex's correct guidance for the still-subprocess backend:
- `spawn`, not `exec`
- consume both stdout and stderr always
- handle `error`, `close`, and dev-server shutdown
- SIGINT first, hard-kill after timeout
- avoid concurrent writes against the same session id
- inherit env via `secret run`, don't `secret get` once at startup

## Open questions

1. **Streaming vs blocking initial integration.** pi-ai is event-stream-first. Our UI currently shows the full reply on dispatch completion. Adopt streaming in v1 (better UX, partial-message rendering) or block on `complete()` for the first cut?
2. **Credential storage location.** Reuse `~/.pi/credentials.json` (pi CLI shares it, single sign-in for both backends) or isolate to `~/.contextual/credentials.json` (cleaner data ownership, separate sign-ins)?
3. **Default provider/model on first dispatch with pi-ai backend.** Hard-code `anthropic / claude-sonnet-4-6` for v1, or prompt the user on first selection? Auto-detect from which OAuth credentials exist?
4. **Model picker surface area.** pi-ai's registry exposes hundreds of models. Expose all of them in the dropdown (overwhelming) or curate (anthropic: opus-4-7, sonnet-4-6, haiku-4-5; openai: gpt-5; google: gemini-3-pro) and let "more…" reveal the full list?
5. **Do we adopt pi-agent-core's multi-turn agent loop**, or stay single-turn? Contextual is conversational, but each dispatch is one user message → one assistant reply (no tool-call rounds in v1). Stay single-turn unless we add tools.
6. **Prompt caching.** pi-ai's Anthropic provider supports `cache_control: ephemeral`. Do we always cache the Fixed prefix, or only when Fixed exceeds the 1024-token cache minimum?

## Why this is the right shape for Contextual specifically

Contextual's pitch — "every LLM call is constructed fresh; statelessness is a feature; the user sees exactly what's being sent" — maps 1:1 onto pi-ai's `(systemPrompt, messages, tools)` Context. There is no hidden state. The Rack UI is literally the request body. Claude's session model would have hidden state; pi-ai doesn't.

Pi-coding-agent stays as the "rich session model" backend for users who want a stateful coding agent with native tree ergonomics. Pi-ai stays as the "pure stateless" backend for users who want vendor flexibility and direct context control. That's a meaningful product distinction, not just two ways to do the same thing.

## Scope of v1

- `@earendil-works/pi-ai@^0.74.0` added as dependency
- `PiAiBackend` works end-to-end for dispatch with Anthropic provider, API-key auth
- Top bar backend + provider + model picker (curated model list)
- Contextual-owned tree manifest schema migration (existing branches get `backendRef.backend = "pi-coding-agent"`)
- Cost chip showing `usage.costUsd` from last dispatch
- README updated with `ANTHROPIC_API_KEY` setup via `secret`

Out of scope for v1, deferred to follow-ups:
- OAuth Pro/Max flow (`POST /api/oauth/login`) — wire in v1.1
- OpenAI / Google providers — wire in v1.2 (the abstraction supports them; just needs UI exposure)
- Streaming UI (partial-message rendering during dispatch) — v1.2
- pi-agent-core multi-turn-with-tools — out of scope; revisit if/when Contextual grows tool execution
- Managed Agents (Anthropic server-side sessions) — separate future doc if ever
