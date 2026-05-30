# Harness Context Contract v0.1

**Status:** active
**Version:** `0.1.0` (see `HARNESS_CONTRACT_VERSION` in `src/lib/harnessContract.ts`)
**Owners:** Codex → API/server · Claude → Explore UI
**Eng background:** `docs/ENG-harness-context-api.md`

This document is the **shared contract** between the API implementer and the UI implementer. Wire shapes are defined in TypeScript at:

```
src/lib/harnessContract.ts   ← source of truth for types + client helpers
```

Server code may extend with adapter internals in `src/server/harnesses/types.ts`, but **REST JSON must match `harnessContract.ts`**.

---

## Problem

Explore needs three distinct views of the same session:

| Mode | Question | Owner data |
|------|----------|------------|
| **at-rest** | What is on disk? | Native JSONL lines + sidecars |
| **turn-ready** | What did the harness send (or best replay)? | Ordered manifest @ turn |
| **contextual** | How does Contextual interpret it? | Atoms, buckets, slices (existing) |

Codex builds the server layer. Claude wires the UI to it. This file is the handshake.

---

## Session identity

### `HarnessSessionKey`

Opaque string used in REST paths. Format:

```
{harness}:{base64url(absolutePath)}
```

Example: `codex:L1VzZXJzL2FyYWNoLy5jb2RleC9zZXNzaW9ucy8uLi4`

**Rules**

- Always `encodeURIComponent(key)` in URL paths
- Resolve from `SessionAnalysis.path` via catalog lookup (`sessions[].path === path`)
- Never construct keys in the UI — use catalog or session open response

### Linking Explore → harness API

When a `SessionAnalysis` session is active:

1. `resolveHarnessSessionKey(session.path)` (client helper)
2. If null, show “not indexed” / trigger catalog refresh
3. Pass `key` to at-rest / turns / manifest endpoints

---

## REST API (v0.1 — implemented)

All routes return JSON. Errors: `{ "error": string }` with 4xx/5xx.

### `GET /api/harnesses/catalog`

Query: `harness?`, `cwd?`, `q?`, `limit?` (default 80)

Response: `HarnessCatalogResponse`

```json
{
  "generatedAt": "ISO8601",
  "total": 12,
  "sessions": [HarnessSessionRef, ...]
}
```

### `GET /api/harnesses/sessions/:sessionKey`

Response: `HarnessSessionRef`

### `GET /api/harnesses/sessions/:sessionKey/at-rest`

Query: `fromLine?` (default 1), `limit?` (default 200), `includeRaw?` (default false)

Response: `AtRestReadResponse`

- `lines[].native` — parsed JSON record (required)
- `lines[].raw` — original line text (only when `includeRaw=true`)
- `nextFromLine` — paginate until null

### `GET /api/harnesses/sessions/:sessionKey/turns`

Response: `HarnessTurnsResponse`

### `GET /api/harnesses/sessions/:sessionKey/manifest`

Query: `turn?` — `latest` | turn index | turn id (default `latest`)

Response: `TurnReadyManifest`

### `GET /api/harnesses/sessions/:sessionKey/sidecars` *(optional v0.1)*

Query: `includeContent?` (default false)

Response: `HarnessSidecarsResponse`

---

## REST API (v0.2 — Codex backlog, not blocking UI)

```
GET  /api/harnesses/sessions/:sessionKey/token-budget?turn=
POST /api/harnesses/manifest/diff
POST /api/harnesses/hot-swap/plan
POST /api/harnesses/hot-swap/execute
```

UI must not depend on v0.2 for the first slice.

---

## UI contract (Claude owner)

### Context mode toggle

Replace current `raw | contextual` with:

```
at-rest | turn-ready | contextual
```

Persist: `contextual.exploreContextMode` (see `ExploreContextMode` type)

| Mode | Data source | Tree structure |
|------|-------------|----------------|
| at-rest | `fetchHarnessAtRest` | `lines/{line}-{recordType}.json` |
| turn-ready | `fetchHarnessManifest` + `fetchHarnessTurns` | `manifest/parts/{order}-{kind}` + turn picker |
| contextual | existing `buildContextTreeForMode` | unchanged |

### Required UI behaviors

1. **Resolve key once per session** — cache `session.path → key` in component state
2. **Loading / error states** — harness API failures must not break contextual view
3. **Truth labels** — show `ManifestPart.truth` and `assembly.confidence` in turn-ready editor chrome
4. **Warnings** — render `TurnReadyManifest.warnings` prominently (Claude ≠ full prompt)
5. **Pagination** — at-rest: load more via `nextFromLine`
6. **Turn picker** — turn-ready: dropdown from `fetchHarnessTurns`, default `latest`

### Files Claude may touch

```
src/lib/harnessContract.ts          ← types/client only; coordinate changes
src/lib/harnessExplore.ts           ← new: hooks + tree builders (create)
src/components/analysis/ContextViewer.tsx
src/components/analysis/SessionAnalysis.tsx
src/lib/contextTree.ts              ← rename old "raw" → keep as atom transcript under contextual only
```

### Files Claude must NOT touch

```
src/server/harnesses/**             ← Codex owner
app/api/harnesses/**                ← Codex owner
src/server/session-analysis/**      ← out of scope this slice
```

---

## Server contract (Codex owner)

### Responsibilities

- Implement/adapt `src/server/harnesses/*` to match wire types
- Keep REST handlers thin — delegate to `registry.ts`
- Preserve `native` on at-rest lines without mutation
- Set honest `assembly.status` / `truth` on manifests
- Paginate at-rest (max 500 lines per request server-side)

### Harness-specific assembly rules

| Harness | Turn anchor | Manifest confidence |
|---------|-------------|---------------------|
| Codex | `turn_context` + user `response_item` | high when `turn_context` present |
| Claude | user records; `compact_boundary` markers | medium, best-effort |
| Pi | user `message` + workspace sidecars | high when sidecars materialized |

### Files Codex owns

```
src/server/harnesses/**
app/api/harnesses/**
docs/ENG-harness-context-api.md
```

Codex must update `src/lib/harnessContract.ts` **only when wire shapes change**, with UI notified via contract version bump.

---

## Type sync rule

1. Change `src/lib/harnessContract.ts` first
2. Bump `HARNESS_CONTRACT_VERSION`
3. Update this doc’s version header
4. Server re-exports or aligns `src/server/harnesses/types.ts`
5. UI uses imports from `@/lib/harnessContract` — never duplicate types

---

## Acceptance criteria

### API (Codex)

- [ ] `bun run typecheck` passes
- [ ] Catalog returns codex + claude + pi sessions
- [ ] At-rest returns native JSONL with pagination
- [ ] Manifest @ latest for Codex session returns `turn-context-logged` when `turn_context` exists
- [ ] Claude manifest includes compaction warnings

### UI (Claude)

- [ ] Three-mode toggle: at-rest / turn-ready / contextual
- [ ] Active session resolves harness key from path
- [ ] At-rest shows native JSON in CodeEditor (json language)
- [ ] Turn-ready shows manifest parts + assembly badge + warnings
- [ ] Contextual mode unchanged
- [ ] `bun run typecheck` passes

---

## Example curls

```bash
# Catalog
curl -s 'http://localhost:5180/api/harnesses/catalog?harness=codex&limit=3' | jq '.sessions[0] | {key, title, harness}'

# At-rest (first page)
KEY='...' # from catalog
curl -s "http://localhost:5180/api/harnesses/sessions/$(python3 -c "import urllib.parse; print(urllib.parse.quote('$KEY', safe=''))")/at-rest?limit=5" | jq '{totalLines, lines: [.lines[] | {line, recordType}]}'

# Turn-ready manifest
curl -s "http://localhost:5180/api/harnesses/sessions/$(python3 -c "import urllib.parse; print(urllib.parse.quote('$KEY', safe=''))")/manifest?turn=latest" | jq '{assembly, warnings, parts: (.parts|length)}'
```

---

## Changelog

| Version | Date | Notes |
|---------|------|-------|
| 0.1.0 | 2026-05-19 | Initial contract; catalog, at-rest, turns, manifest |
