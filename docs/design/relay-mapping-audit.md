# Relay Mapping-Quality Audit

Prep for the two-stage "Relay" capture (Stage A investigates + writes `HANDOFF.md`;
Stage B opens by reading that handoff and implements). Goal: be able to look at a
capture and say "context was mapped correctly / not," with special attention to the
buckets the corpus has had ~zero evidence for: **collaboration, handoff, decisions,
history.**

All file:line references are to `src/server/session-analysis/index.ts` unless noted.
Bucket taxonomy lives in `src/lib/sessionAnalysis.ts`.

---

## 1. How classification works today

### 1a. The bucket set (no distinct `handoff` bucket)

`src/lib/sessionAnalysis.ts:6-67` defines the ten buckets:
`task, codebase, tools, environment, verification, decisions, collaboration,
policy, history, media`.

**There is no `handoff` bucket.** "Handoff" only exists one layer down, as an
*artifactType* / *lifecycle* / *blockKind* value derived **from** the
`collaboration` bucket:

- `artifactTypeFor` — `index.ts:601`: `if (chunk.bucket === "collaboration") return "handoff";`
- `lifecycleFor` — `index.ts:648`: `if (chunk.bucket === "collaboration" || artifactType === "handoff") return "handoff";`
- `kindForSlice` — `index.ts:1164`: `if (slice.artifactType === "handoff") return "handoff-state";`
- recipe slot — `index.ts:1259`: a non-required `handoff` slot, fed only by `collaboration-state` blocks (`slotIdForBlock`, `index.ts:1262-1268`).

So **handoff is entirely downstream of the `collaboration` bucket.** If an atom
does not land in `collaboration`, nothing in the pipeline can ever label it a
handoff artifact, and the `handoff` recipe slot stays empty/`missing`.

### 1b. Where bucket assignment actually happens

Each per-harness parser walks transcript records and calls `pushChunk` with a
bucket. The bucket comes from one of four routing functions, by record kind:

| Record kind | Router | Default if nothing matches |
|---|---|---|
| user message | `classifyUserText` (`index.ts:674`) | `history` (`:708`) |
| assistant text / reasoning | `classifyAssistantText` (`index.ts:711`) | `history` (`:733`) |
| tool **call** | hard-coded `"tools"` (`:1504, :1588, :1708, :1818`) | — |
| tool **output** | `classifyToolOutput` (`index.ts:736`) | `tools` (`:807`) |
| developer/system message | hard-coded `"policy"` (`:1467`) | — |
| codex `reasoning` record | hard-coded `"decisions"` (`:1533`) | — |
| image content | hard-coded `"media"` (`:1492`) | — |

The four parsers (`parseCodexJsonl :1437`, `parseClaudeJsonl :1547`,
`parsePiJsonl :1651`, `parseGrokAcpJsonl :1748`) differ only in how they pull
text/role/command out of each native format; they all funnel into the **same four
routers**. So classification quality is identical across harnesses — fix the
routers and you fix every lane.

### 1c. `collaboration` — what drives it (keyword-only, scout-coded)

Three independent code paths can emit `collaboration`, all pure substring matches:

**User text** (`classifyUserText`, `index.ts:674-709`):
```ts
if (lower.includes("subagent_notification")) return "collaboration";   // :676
...
if (lower.includes("scout") || lower.includes("broker") ||
    lower.includes("flight") || lower.includes("handoff"))             // :700-705
  return "collaboration";
```
But note the **ordering trap**: the `task` block at `:688-699` runs *first* and
catches `please`, `build`, `fix`, `why`, `error message`, `my request`. A user
prompt like "Read HANDOFF.md and implement the fix" hits `fix` → **`task`**,
never reaching the `handoff` check below it.

**Assistant text** (`classifyAssistantText`, `index.ts:711-734`):
```ts
if (... "root cause" || "decided" || "settled" || "rationale" ||
    "recommend" || "summary" || "plan") return "decisions";            // :713-722
if (... "subagent" || "scout" || "broker" || "handoff" || "flight")
  return "collaboration";                                              // :724-731
```
Again `decisions` wins ties — an assistant turn that says "here's my plan for the
handoff" routes to `decisions`, not `collaboration`.

**Tool output** (`classifyToolOutput`, `index.ts:782-791`):
```ts
if (lower.includes("scout") || lower.includes("broker") ||
    lower.includes("subagent") || lower.includes("invocation") ||
    lower.includes("flight") || lower.includes("ask failed"))
  return "collaboration";
```
Note: the word **`handoff` is NOT in the tool-output collaboration check** — only
the agent-to-agent vocabulary (scout/broker/subagent/flight). And this check sits
**after** the file-read check at `:769-781`, which catches any `cat`/`sed`/`read`
command first. So a tool output is essentially never collaboration unless it
literally contains scout/broker chatter.

**Bottom line for `collaboration`:** today it is a *Scout-product* detector
(subagent notifications, broker, flights), not a generic "another agent handed me
context" detector. The only generic hook is the bare token `"handoff"` in user
and assistant *text*, and even that is shadowed by the `task`/`decisions` checks
that run first.

### 1d. `decisions` — what drives it

Two sources:

1. **codex `reasoning` records** are hard-pinned to `decisions` (`index.ts:1531-1539`)
   regardless of content — codex thinking summaries always count as decisions.
   pi `thinking` blocks and grok `agent_thought_chunk` instead go through
   `classifyAssistantText` (`:1698, :1768`), so they only become `decisions` if
   the keywords fire.
2. **assistant text** containing `root cause / decided / settled / rationale /
   recommend / summary / plan` (`classifyAssistantText :713-722`).

So `decisions` is well-fed for codex (every reasoning block) but keyword-gated for
claude/pi/grok. An assistant turn that reasons through an approach without using
one of those seven words falls through to `history`.

### 1e. `history` — what drives it

`history` is the **fallthrough/default** for any user or assistant text that
matches none of the keyword tiers (`classifyUserText :708`, `classifyAssistantText
:733`). It is not positively detected; it's the bucket of "uncategorized prose."
It also catches the missing-transcript fallback (`:1882`). Practically, `history`
fills up with narration and recap that didn't trip a keyword — which is roughly
the right semantic, but it's a residual, not a signal.

### 1f. `pinned`, lifecycle, stability

- **`pinned`** is set in `pushChunk` (`index.ts:810-818`). Default:
  `bucket === "policy" || "environment" || "task"`. Parsers override it:
  developer/system messages pin `true` (`:1467`); user messages pass `undefined`
  → fall to the default (so a user message classified `task` pins, but one
  classified `collaboration`/`history` does **not**); assistant text and all tool
  records pass `false` explicitly. **Consequence:** collaboration/handoff/decisions
  atoms are *never pinned*, so in threshold packing (`snapshotAt :870-914`, which
  keeps pinned chunks first then a recent tail) a handoff read is only retained if
  it happens to fall in the recent-tail window.
- **`lifecycle`** (`lifecycleFor :642-650`): policy/task/environment→`orientation`;
  diff/tools→`implementation`; verification/test-log→`verification`;
  collaboration/handoff→`handoff`; else→`investigation`.
- **`stability`** (`stabilityFor :652-659`): policy/task/decisions→`durable`;
  environment/runtime-log/test-log→`stale-prone`; tools/media→`session-local`;
  **else→`durable`** (so collaboration and history default to `durable`).

These three are all **derived from the bucket**, so they inherit every
misclassification upstream. Getting the bucket right is the whole game.

---

## 2. The Relay trace — where does Stage B's `HANDOFF.md` read land today?

Stage B opens with: *"Read `HANDOFF.md`. Implement ellipse binding per the plan…"*
Walk the two atoms this produces.

### Atom 1 — the user prompt ("Read HANDOFF.md and implement…")

Routed by `classifyUserText` (`index.ts:674`). Order of checks:
1. `subagent_notification`? No.
2. policy keywords (`agents.md`, `permissions`, `available skills`…)? No.
3. **task keywords** (`:688-699`): the prompt contains **"implement"/"fix"** and
   likely "pass". Wait — the exact tokens checked are `please, build, fix, why,
   error message, my request, what i would like`. The Stage B prompt says
   "Implement … so `npm test` passes" — if it contains **"fix"** anywhere it hits
   `task`; even without "fix", real prompts almost always include one of these.
   → **`task`** (and, being a user message, it **pins**).
4. The `handoff` check at `:700-705` is **never reached.**

**Result: the kickoff prompt → `task`, not `collaboration`.** That's arguably
fine (it *is* the task), but it means the "I'm resuming from a handoff" signal is
lost at the prompt.

### Atom 2 — the tool output that returns the `HANDOFF.md` contents (the load-bearing one)

The agent reads the file. This is two records:
- the tool **call** → hard-coded **`tools`** (`:1588` claude / `:1504` codex). Fine.
- the tool **output** (the file body) → `classifyToolOutput(output, command)`.

For a claude `Read`, `command = input.file_path = ".../HANDOFF.md"`
(`index.ts:1586`). For codex, `command` is the `cat`/`sed` string. Trace
`classifyToolOutput` (`:736-807`) in order:

1. build-/test- keywords (`:739-752`)? The handoff prose may mention "npm test",
   "test", "verified the rectangle tests pass". **`lower.includes("test failed")`
   no**, but plain `bun test`/`vitest`/`typecheck` substrings could appear in a
   well-written handoff that quotes the test command. Usually no exact match here →
   continue.
2. environment keywords (`git status`, `localhost`, `branch`, `provisioning`…,
   `:753-768`)? A handoff that says "on branch X" could trip `current branch`.
   Usually no → continue.
3. **codebase / file-read keywords** (`:769-781`):
   ```ts
   commandLower.includes("read")    // claude Read → command is the file path, NOT "read"
   commandLower.includes("sed ") || startsWith("cat ") || "git show" ...
   ```
   - **codex lane:** the command is `cat HANDOFF.md` / `sed -n … HANDOFF.md` →
     `cat `/`sed ` matches → **`codebase`.**
   - **claude lane:** `commandLower` is the *file path* `…/HANDOFF.md`; it does
     **not** contain "read"/"cat"/"sed". So this branch is skipped on the command.
     Continue.
4. collaboration keywords (`:782-791`): scout/broker/subagent/flight/`ask failed`.
   A normal engineering handoff about ellipse geometry contains **none** of these.
   → skip. (Recall: `handoff` is *not* in this list.)
5. **second codebase tier** (`:792-806`): matches if `lower` (command + first 8k
   of output) contains `.ts`, `.tsx`, `read`, `cat `, `.json`, etc. The HANDOFF.md
   body **names the files to edit** — `geometry.mjs`, `shapes.mjs`, `binding.mjs`,
   and almost certainly `.ts`/`.mjs`/`bindingPoint`/test paths. `.mjs` is not in
   the list, but `read` is, and the prose will likely contain "read" or a `.json`
   or a `.ts` path. → **`codebase`.**
6. fallthrough → `tools` (only if the handoff prose somehow named no files and no
   keywords — unlikely).

**Most likely outcome: the `HANDOFF.md` read classifies as `codebase`** (a
file-read), in **both** lanes — codex via `cat `/`sed `, claude via the
`.ts`/`read`/`.json` tier. It is indistinguishable from reading any other source
file. It will **not** be `collaboration`, will **not** get `artifactType:
"handoff"`, will **not** feed the `handoff` recipe slot, and will **not** be
pinned (tool outputs pass `pinned: false`, `:1517/:1613`).

**This is the core finding: the single atom the whole Relay scenario exists to
exercise — Stage B ingesting another agent's handoff doc — lands in `codebase`
today and is invisible as collaboration/handoff.** The only thing that would
rescue it is if the handoff text happened to contain the literal word "scout",
"broker", or "subagent" — which a clean engineering handoff won't.

---

## 3. Audit checklist — what a correct Relay capture should look like

Use this to eyeball a capture's `bucketInsights` / atom list per stage. "Expected"
= what *should* be true of a well-mapped Relay; "Today" = what the current
classifier will actually produce (so you can see the gap).

### Stage A — investigate + write HANDOFF.md (no code)

| Bucket | Expected (well-mapped) | Today (current classifier) |
|---|---|---|
| `task` | The kickoff prompt (pinned). | OK — prompt hits `task` keywords, pins. |
| `codebase` | Heavy — reads of `geometry.mjs`, `shapes.mjs`, `binding.mjs`. | OK — `cat`/`sed`/`.ts` tiers fire. |
| `decisions` | **Heavy** — the whole point is reasoning out the ellipse approach. | codex: OK (reasoning records auto-`decisions`). claude/pi/grok: **under-counts** unless the text uses plan/rationale/recommend/root cause. |
| `collaboration`/handoff | The act of **writing** HANDOFF.md should register as producing a handoff. | **MISSING** — the file *write* is a `tools` call; its content never routes to `collaboration`. No handoff artifact is created in Stage A at all. |
| `verification` | Light — Stage A says what it verified (e.g. "rectangle tests green") but runs no fix. | Low; fine. |
| `history` | Some narration. | Likely inflated — non-keyword reasoning falls here instead of `decisions`. |

**Stage A "mapped correctly" tell:** `decisions` should be a top-3 bucket and the
recipe's `decisions` slot `covered`; the durable residue should be a
decision-ledger + a handoff-state block. **Red flag:** `decisions` < ~8% or the
`handoff` slot `missing` while the session literally authored a HANDOFF.md.

### Stage B — resume from HANDOFF.md + implement

| Bucket | Expected (well-mapped) | Today (current classifier) |
|---|---|---|
| **First atoms: `collaboration`/handoff** | The opening `HANDOFF.md` read is the defining collaboration atom — Stage B's context *originates* from another agent. Should be `collaboration`, `artifactType: handoff`, lifecycle `handoff`, ideally pinned. | **MISSING** — lands in `codebase` as a generic file-read (§2). This is the headline failure. |
| `task` | Kickoff prompt (pinned). | OK. |
| `codebase` | Reads of the three `.mjs` files. | OK. |
| `decisions` | Some — notes on deviations from the handoff. | codex OK; others keyword-gated. |
| `verification` | **Heavy** — `npm test` runs until the 4 ellipse cases pass. | OK — `bun test`/`vitest`/`test failed` → `verification` (`:739-752`). Confirm the harness's test command actually matches; `npm test` itself is **not** in the keyword list (see §4 gap). |
| `tools`/implementation | The edit/diff applying the fix. | OK — diff → `implementation` lifecycle. |

**Stage B "mapped correctly" tell:** within the first ~5 atoms there is a
`collaboration` atom with `artifactType: handoff` and `lifecycle: handoff`, the
`handoff` recipe slot is `covered`, and `verification` is a top bucket.
**Red flag (and the current reality):** zero `collaboration` atoms; the handoff
read sits in `codebase` next to the source files; `handoff` slot `missing`.

### Cross-stage tell

The Relay's whole thesis is that the durable residue is a **handoff artifact**
linking the pair. A correct capture shows a `handoff-state` block produced by
Stage A and *consumed* (re-read) by Stage B. Today neither stage emits a handoff
artifact, so the pair looks like two unrelated codebase-heavy sessions.

---

## 4. Gaps + fixes (prioritized)

### ★ FIX 1 (single most important) — detect a handoff-document read in `classifyToolOutput`

**Problem:** Stage B reading `HANDOFF.md` is the one atom the scenario is built to
exercise, and it falls into `codebase` (§2). Fix this and the headline failure goes
away.

**Where:** `classifyToolOutput`, `src/server/session-analysis/index.ts:736`. Add a
filename/path check **before** the codebase tiers (`:769`), keyed off `command`
(the file path/command) so it beats `cat`/`sed`/`.ts`:

```ts
// near the top of classifyToolOutput, before the codebase checks at :769
if (/\b(handoff|hand-off|handover)\b/i.test(command) ||
    /\bHANDOFF\.md\b/i.test(command) ||
    /\b(handoff|next engineer|for the next|pick(ing)? up where|resume from)\b/i
      .test(output.slice(0, 2000))) {
  return "collaboration";
}
```
Anchor on the **filename in `command`** first (most robust — `HANDOFF.md`,
`*HANDOFF*.md`), with a content fallback for the doc's conventional phrasing.
This single change makes the read `collaboration` → `artifactType: handoff`
(`:601`) → `handoff` lifecycle (`:648`) → fills the `handoff` slot.

**Also pin it:** tool outputs pass `pinned: false` (`:1517, :1613, :1729, :1832`).
A handoff read should survive threshold packing. Either special-case
collaboration tool-outputs to `pinned: true` at those call sites, or broaden the
`pushChunk` default (`:815`) to include `collaboration`. Pin is what guarantees
the handoff is retained in `snapshotAt` rather than depending on the recent tail.

### FIX 2 — make `collaboration` detect generic agent-handoff, not just Scout

**Problem:** all three collaboration paths are Scout-product-coded
(subagent/broker/flight). A clean engineering handoff trips none of them, and the
bare token `handoff` is shadowed by earlier `task`/`decisions` tiers (§1c).

**Where & how:**
- `classifyUserText` (`:674`): hoist a handoff/relay check **above** the `task`
  tier at `:688`, so "Read HANDOFF.md and implement…" registers the resume signal
  before `fix`/`implement` claims it for `task`. (Tradeoff: decide whether the
  *prompt* should be `task` or `collaboration` — arguably the read atom carrying
  the handoff is the better signal, so FIX 1 may be enough and you can leave the
  prompt as `task`.)
- `classifyToolOutput` collaboration tier (`:782`): add `handoff`, `handover`,
  `next engineer`, `relay` to the keyword list — it's conspicuously absent there
  today.

### FIX 3 — un-gate `decisions` for non-codex lanes

**Problem:** `decisions` is auto-filled only for codex (reasoning records →
`:1531`). pi `thinking` and grok `agent_thought_chunk` route through
`classifyAssistantText` and only count as `decisions` if a keyword fires; claude
has no separate reasoning channel at all. The Relay is decision-heavy by design,
so claude/pi/grok Stage A will under-report `decisions`.

**Where:** treat `sourceType === "reasoning"` as `decisions` uniformly. Either at
the parser call sites (`parsePiJsonl :1698`, `parseGrokAcpJsonl :1768` already tag
`sourceType: "reasoning"` — route those to `decisions` directly instead of
`classifyAssistantText`), or add `if (meta.sourceType === "reasoning") return
"decisions"` inside the assistant path. Note `artifactTypeFor :600` already maps
`sourceType === "reasoning"` → `decision`, so the bucket is the only thing out of
step.

### FIX 4 — broaden the `verification` command list to include `npm test`

**Problem:** the verification detector (`:739-752`) lists `bun test`, `vitest`,
`pytest`, `bun run build`, `swift build`, `typecheck`, `vite build` — but **not
`npm test`**. The Relay sandbox's `CLAUDE.md` mandates `npm test`. A bare
`npm test` run with passing output won't match `test failed`/`build failed`, so a
green test run could fall through to `tools`. (A *failing* run still won't say
"test failed" necessarily.) Add `npm test`, `npm run test`, `npx vitest`, and a
looser `/\btests?\s+(pass|fail)/i` to be safe.

### Priority order for the maintainer

1. **FIX 1** — handoff-document detection in `classifyToolOutput` (+ pin it).
   Without this the Relay's defining atom is invisible; with it, the scenario
   demonstrates exactly what it's meant to.
2. **FIX 4** — `npm test` in the verification list (cheap, and the sandbox uses
   `npm test`, so Stage B verification depends on it).
3. **FIX 3** — uniform `reasoning → decisions` so non-codex lanes show the
   decision-heavy Relay posture.
4. **FIX 2** — generic collaboration vocabulary (polish; FIX 1 covers the
   load-bearing path).
