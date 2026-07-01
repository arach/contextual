# DESIGN: Cartridge Surfaces

Status: design spec, concept mode
Owner: Contextual (Claude sibling)
Last updated: 2026-05-30
Source material: `/studio` route, `CTX-001..005`, planner-workbench + health-console studies, `CONTRACT-session-package.md`, `CONTRACT-launch-and-fork.md`, `ENG-contextual-platform.md`.

## 0. Frame

Contextual wins upstream: planning, sourcing, packaging, profiling, instantiating, truthful forking. It does not control hidden in-flight provider buffers. Four product surfaces carry that work:

| Surface | Owner | Lifecycle moment | Verb |
| --- | --- | --- | --- |
| Cartridge Detail | Developer-first, agent-readable | After Package, before Launch | Package |
| Planner Workbench | Developer + Agent co-edit | Before Package | Package |
| Health Console | Developer-first | Before Launch / Fork | Package + Instantiate |
| Launch / Fork Preview | Agent-first, developer-auditable | Instantiate, Fork | Instantiate, Fork |

Visual direction: Hudson/Studio dense ops chrome, mono eyebrows at 9-11px / 0.18-0.24em tracking, serif body for prose blocks, status pills via `studio/atoms`. No marketing hero. Single accent (`--scout-accent`). Status tones from `--status-{ok,warn,error,info,neutral}-fg`. Mono numerals for tokens / scores / hashes.

## 1. Page Inventory

New routes under the existing `/studio` slug router (`app/studio/[[...slug]]/page.tsx`, `src/studio/studioRegistry.ts`):

```txt
/studio/cartridges                                     # cartridge index (lightweight)
/studio/cartridges/[id]                                # CARTRIDGE DETAIL
/studio/cartridges/[id]/versions/[version]             # version pin (same shell, version-locked)
/studio/cartridges/[id]/planner                        # COLLABORATIVE PLANNER (workbench)
/studio/cartridges/[id]/health                         # HEALTH CONSOLE
/studio/cartridges/[id]/launch                         # LAUNCH PREVIEW
/studio/cartridges/[id]/fork                           # FORK PREVIEW
```

Existing studies (`/studio/studies/planner-workbench`, `/studio/studies/health-console`) stay as design-study fossils until the live routes ship; the workbench in §3 supersedes them.

Registry additions (preserve `StudioPage<bucket, surface, status>` shape):

- bucket: add `"cartridges"` next to `foundations | presentations | studies`.
- surface: `"product"` for the live cartridge surfaces (distinct from `vision | engineering | design`).
- status: reuse `active | draft | study`; cartridges themselves have their own `lifecycle` (`draft | review | published | archived`) — keep them separate to avoid collapsing artifact lifecycle into page status.

## 2. Cartridge Detail Page

Route: `/studio/cartridges/[id]` (`/versions/[v]` pins history view).

### 2.1 Header band

Two-row, ruled bottom, no hero.

- Row 1 (mono eyebrow): `cartridge / <id>` · lifecycle pill (`DRAFT|REVIEW|PUBLISHED|ARCHIVED`) · version selector (`v0.4` mono, dropdown with diff affordance).
- Row 2: H1 cartridge name (medium 40-44px, ink-strong) + one-line intent in serif body.
- Right rail header chip stack: workspace scope, target token target (e.g. `15k working set`), refresh window (`refresh by 2026-06-13`), provenance health dot.

Reuses: `StatusPill`, `SectionKicker`, mono eyebrow grid from `NorthStarPage`.

### 2.2 Section A — Intent

Two-column grid (`280px / 1fr`) like CTX presentations:

- Left: kicker `intent`.
- Right: serif paragraph of the cartridge `description`; followed by a tagged scope strip (`scope: repo · path · branchHint`) and `compatibility` row with one chip per target harness (`codex native`, `claude transform-required`, `pi-ai compatible`).

Open decisions: should `intent` be plain text or structured (problem / outcome / non-goals)? Recommendation: free-form intent + an `objectives[]` list immediately under it so planner-derived objectives survive.

### 2.3 Section B — Source Map

Goal: show where this cartridge's truth comes from before showing the parts that distill it.

Table, mono header row, divider-only (no fills):

| Source | Family | Path / ref | Last observed | Truth | Coverage |
| --- | --- | --- | --- | --- | --- |
| `harness/codex` | session | `~/.codex/.../session-abc` | 2d ago | logged | 12 turns |
| `docs/HARNESS-CONTRACT.md` | doc | `docs/HARNESS-CONTRACT.md@a1b2c3` | 6h ago | logged | full |
| `claude-prompt-recon` | reconstruction | inferred from at-rest lines | 1w ago | reconstructed | partial |
| (manual) `target-harness-notes` | manual | — | session author | manual | n/a |

Truth chips use the four-state palette from `PackageProvenance.truth`: `logged | reconstructed | inferred | manual`. Coverage and freshness color-flip via `--status-*-fg`. Source rows link out to Explore at the matching native record (deep link by `harnessSessionKey` or `manifestPartId`).

### 2.4 Section C — Parts

The body of the cartridge. Render as a vertical list, not a card grid; parts have natural order and that order matters at launch time.

Per row:

- Sticky left gutter: drag handle (order) + mono `01..NN`.
- Title row: `kind` chip (`task-brief`, `repo-map`, `decision-ledger`, ...), title, `required|optional` tag.
- Meta row (mono 11px): `tokens N` · `truth: logged/reconstructed/...` · `freshness: durable/session-local/stale-prone` · `compat: codex,claude` (omits when same as cartridge default).
- Collapsible body preview (3 lines serif by default; click to expand).
- Right cluster: provenance count badge (`3 src`) that opens a popover listing every `PackageProvenance` (sessionId, manifestPartId, contentHash[:8], observedAt, truth).

Bulk affordances: token bar across the top of the section (`required 4.1k / 15k target / 21k max`), `compress`, `re-source`, `pin order`. Filters: by `kind`, `truth`, `freshness`.

Open decisions:
- Provenance per part vs per cartridge default — recommend per part with fallback to cartridge-level when omitted, so contract validation can stay strict for `published`.
- Whether to surface a `discard-note` part inline or in a folded "omitted" subsection (recommend folded, default-collapsed but counted in the part count).

### 2.5 Section D — Load Profiles

Three-column profile strip echoing `loadProfiles` in `StudioPages.tsx` but operational instead of illustrative:

- `Briefing` (required) — 4k target, lists which `parts` it pulls, shows the actual compiled token cost vs target.
- `Working Set` (recommended) — 15k target, same layout.
- `Deep Pack` (optional) — 45k target.

Each column ends with two links: `preview launch ↗` (goes to §5) and `eval coverage ↗` (jumps to §G eval state). Tokens use mono. Slot-fit warnings (`over budget`, `missing required part`) ride along as inline `StatusPill` chips.

### 2.6 Section E — Freshness

Compact 2-column block: stability of cartridge (`durable | session-local | stale-prone`) + the most-recent `refreshBy`. Below: a table of stale-prone parts with `invalidatesOn[]` and the `refreshCommand` (mono, copyable). A single primary action `refresh now` and a secondary `acknowledge stale`.

### 2.7 Section F — Provenance review (lineage)

Less about per-part attribution (already in §2.4) and more about the cartridge as a whole. List of `PackageHistoryEntry` (version, when, note, author). Lineage edges out:
- packages this one was forked from
- launches that consumed it
- forks derived from those launches

Visual: vertical lineage tree, mono labels, hairline strokes. No timeline curves — straight rules only.

### 2.8 Section G — Eval state

Per cartridge: a `EvalCase[]` table:

| Case | Target | Last run | Result | Truth claim |
| --- | --- | --- | --- | --- |
| `native-vs-replay-fork` | claude | 4h ago | warn | `claims native; observed replay` |
| `memory-boundary` | claude | 4h ago | pass | `memory absent → not asserted` |
| `context-handoff` | pi-ai | 2d ago | pass | `handoff verified by hash` |
| `source-truth-claims` | codex | 6h ago | pass | — |

Result chips drive the rebuild recommendation surfaced in Health (§4).

### 2.9 Section H — Version history

`PackageHistoryEntry` table with mono `version`, relative `when`, serif `note`, and an inline `diff` button that swaps the page into compare mode (versions/[v] route).

### 2.10 Cartridge Detail — open decisions

1. Where does "owner" live — header or version-history row? Recommend header (one owner per cartridge).
2. Should published cartridges allow inline edits? Recommend no; require a `draft` checkpoint before edit.
3. Render order: source-map before parts (current) vs parts before source-map. Source-first is more honest about the upstream story.

## 3. Collaborative Planner Workbench

Route: `/studio/cartridges/[id]/planner` (also reachable as `/studio/cartridges/new/planner` for green-field).

The planner is the only surface where the agent writes alongside the developer. UI should make that co-authorship legible.

### 3.1 Layout

Three columns at desktop, collapsible:

```txt
| 280  |          1fr           | 360  |
| nav  | stage workspace        | side |
```

- Left nav: stage list (Intent · Scope · Sources · Targets · Profiles · Evals · Refresh · Review). Status dot per stage (`untouched | drafting | proposed | accepted`). Persistent at top: cartridge intent in one line, `lifecycle` pill.
- Center: the active stage (see §3.3-3.9).
- Right side: **decisions ledger** — every accept / omit / defer with author chip (`agent` or `dev`) and a one-line reason. Filter pills: `accepted | omitted | deferred | pending`.

### 3.2 Stage scaffolding

Each stage shares a `StageHeader` (mono eyebrow `stage 03 / sources`, H2 title, serif one-paragraph charter), a `Proposal` zone (agent-authored draft), a `Decision row` (Accept / Omit / Edit / Defer), and a `Notes` row (dev free-text).

The Proposal zone always shows author chip (`agent` / `dev`), timestamp, and a "regenerate" affordance that bumps a proposal version (the prior proposal stays visible, collapsed, under a `2 prior proposals` toggle). Accept commits the proposal to the decisions ledger and freezes the stage value.

### 3.3 Stage 1 — Intent

Form-light: single textarea seeded by agent. Below: `objectives[]` chips (add / remove, drag to reorder). Right: a "starter prompts" rail with 3-4 suggested objectives generated from prior sessions in this workspace.

### 3.4 Stage 2 — Scope

Inputs:
- workspace kind (`repo | directory | global`) radio.
- path (file picker), branch hint (free text).
- "carry over from" — pick a prior cartridge to inherit scope.

A live `WorkspaceScopePreview` shows what will be in-scope (count of files, doc tree depth) and what is hidden.

### 3.5 Stage 3 — Sources

The heaviest stage. Two stacked tables:

1. **Candidate sources** — auto-discovered from harness sessions, docs, sidecars matching this scope. Columns: `source`, `family`, `last touched`, `signal estimate`, `truth`, `agent recommendation`. Each row has Include / Exclude / Inspect (jumps to Explore).
2. **Selected sources** — the live source map being built. Same columns plus order. Drag to reorder.

Agent recommendation is a one-word hint (`keep`, `skip`, `freshen`). Dev override is one click.

### 3.6 Stage 4 — Targets

Compact target picker for `LaunchTarget.harness`: codex, claude, pi, pi-ai. Each is a card with a "compatibility forecast" computed from current selected sources/parts: `native | compatible | transform-required | unsupported` with the reason ("Claude has no native fork from manifest — replay fork only").

### 3.7 Stage 5 — Profiles

Three-row editor (Briefing / Working Set / Deep Pack). Each row: target token budget, allowed `slot.kind`s, freshness floor (`durable only`, etc.). Live token meter for the current selection (sum of required parts ≤ briefing budget; etc.). Validation tied to `BudgetProfile`.

### 3.8 Stage 6 — Evals

Pick from a library of `EvalCase` templates (`native-vs-replay-fork`, `memory-boundary`, `context-handoff`, `source-truth-claims`) — same set surfaced in §2.8. Show: which targets each eval applies to, expected truth claim. Agent proposes a starter set; dev edits.

### 3.9 Stage 7 — Refresh

`FreshnessPolicy` editor: per stale-prone part, set `refreshBy`, `invalidatesOn[]`, `refreshCommand`. Right-side preview shows the cartridge's overall freshness "weather": durable parts, soft-stale parts, hard-stale parts.

### 3.10 Stage 8 — Review

Single scrollable summary of all accepted decisions, rendered exactly as they'd appear in §2 (Cartridge Detail). One CTA: `Compile cartridge` → writes a `draft` version, jumps to Cartridge Detail.

### 3.11 Decisions ledger (right rail)

Always-on. Each entry:

```
[accept] sources · 03           agent → dev
include ~/.codex/.../session-abc; skip claude reconstruction (low signal)
2026-05-30 14:02 · revisit if claude-prompt-recon lands
```

Click an entry → scrolls/opens the relevant stage in read-only "decision pinned" mode (used during Review and post-publish edits). Omit and Defer entries get muted styling but stay visible — that's the honest record of what was considered.

### 3.12 Planner — open decisions

1. Multi-agent? Should `agent` be a single author chip or a colored multi-author chip (Claude / Codex co-planning)? Recommend named-agent labels (`@claude`, `@codex`) on each proposal, single-author per proposal.
2. Where does freeform chat go? Either (a) a thin "transcript" drawer under each stage, or (b) drop the chat entirely and have the agent only emit proposals + ledger entries. Strong recommendation: option (b). Chat in this tool re-creates the failure mode the planner exists to fix.
3. Should `Compile cartridge` enforce a complete eval pass before allowing `review` lifecycle? Recommend no — but block `published` until eval suite passes at least once.

## 4. Health Console

Route: `/studio/cartridges/[id]/health`.

Operational dashboard, not marketing. Existing `HealthStudyPage` is the right starting frame — five `MetricTile`s + sidebar recommendation — but the live version pulls real numbers and binds every tile to an evidence drill-in.

### 4.1 Layout

```txt
| 1fr (metrics grid)                | 360 (advisory) |
```

- Left: 5 metric tiles in `bg-studio-rule` grid (the existing `MetricTile` is reusable as-is). Tiles: Efficiency, Freshness, Coverage, Provenance, Evals.
- Right: advisory rail — one and only one recommendation banner, followed by a per-source state table.

### 4.2 Metric tiles

Each tile shows: label (mono eyebrow), big numeral (mono medium 34px), trend chip (`▲ +6 since v0.3`), and a one-line detail line. Hover/click reveals a popover with the underlying calculation:

- **Efficiency**: `1 − (duplication + low_signal) / total_tokens`. Detail: `11% duplication, 6% low signal`.
- **Freshness**: weighted age of sources vs each part's `FreshnessPolicy`. Detail: lists offending families.
- **Coverage**: how many of the declared `LaunchTarget`s have all required parts present and compatible. Detail: `OpenCode weak, pi-ai strong`.
- **Provenance**: % of non-manual parts with verifiable `contentHash`. Detail: `2 manual parts unflagged`.
- **Evals**: `passed/total` plus failing case names.

### 4.3 The recommendation

The Health Console exists to emit a single action. Render as a banner card across the top of the advisory rail:

| Tone | Label | Trigger |
| --- | --- | --- |
| ok | `KEEP` | all metrics ≥ threshold; evals green |
| info | `REFRESH` | freshness < threshold but coverage and provenance ok |
| warn | `REBUILD` | coverage or provenance failing; structural change needed |
| error | `BLOCK LAUNCH` | required parts missing/unverified, or critical eval failing |

Banner has the verb, a one-paragraph "why" referencing exact sources, and 1-2 mono action buttons (`refresh now`, `open planner / sources`, `acknowledge & launch anyway`). The "anyway" path requires a textarea reason that lands in the decisions ledger.

### 4.4 Source state table

Reuse the `sourceState` mini-table already prototyped in `HealthStudyPage`, but bind to real per-source freshness, with deep links to Explore. Columns: source, what it covers, state (`fresh | review | stale | missing`).

### 4.5 Coverage matrix

Add (new, below the source table): a target-by-slot matrix.

```
              briefing  working-set  deep-pack
codex            ●          ●            ●
claude           ●          ◐            ◐      ← transform-required
pi               ●          ●            —
pi-ai            ●          ●            ●
```

Mono glyphs (`● ◐ ○ —`) keep it scannable. Click a cell → opens the matching launch preview (§5).

### 4.6 Health — open decisions

1. Should the recommendation be agent-overridable or developer-only? Recommend developer-only authority to escalate (e.g. force REBUILD), agents can request via decisions ledger.
2. Threshold tuning per workspace vs global? Recommend per-cartridge thresholds with a workspace-level default.

## 5. Launch / Fork Preview

Routes: `/studio/cartridges/[id]/launch` (and `/fork`). Same shell, different prep data.

This is the agent-first surface. Optimize for: (a) the agent emitting a `LaunchPlan` / `ForkPlan` it can execute, (b) the developer being able to audit and intervene in seconds.

### 5.1 Common shell

Two-pane layout:

```txt
| 360 (target & profile)   | 1fr (compiled preview) |
```

Top bar: target chip (`claude · cwd: ~/dev/foo · model: opus-4-7`), profile selector (Briefing / Working Set / Deep Pack), `status` pill (`READY | WARNINGS | BLOCKED` driven by `LaunchPlan.status`).

### 5.2 Target & profile pane (left)

- Target: harness, cwd, model, provider. Editable; changes recompile.
- Profile choice with token budget bar (estimated vs max input window for the chosen model).
- Preflight checklist (from `CONTRACT-launch-and-fork.md` §Preflight): each row is a `StatusPill` plus terse text. Examples:
  - `auth · ok` (claude session token present)
  - `cwd · ok`
  - `parts · ok` (3/3 required present)
  - `stale · warn` (1 part stale-prone, refresh available)
  - `budget · ok` (8.2k / 200k window)
  - `sidecars · ok` (2 materializable)
- Bottom: lineage strip (only on `/fork`). See §5.4.

### 5.3 Compiled preview pane (right)

Render the `promptParts: LaunchPromptPart[]` as a structured document, not a single text dump. One block per `LaunchRecipeSlot`:

```
[slot] task-brief                  required · 0.6k    truth: logged
─────────────────────────────────────────────────────
Implement the cartridge-detail surface defined in CTX-002...
...
[from] parts: cartridge.parts.task-brief.v0.4

[slot] working-set                 required · 5.4k    truth: mixed
─────────────────────────────────────────────────────
src/studio/StudioPages.tsx
src/studio/studioRegistry.ts
docs/CONTRACT-session-package.md
[from] parts: working-set.tracked-files (logged)
       parts: working-set.manual-pins (manual)
[transform] truncated 3 files to 200 lines each (preview only)
```

Each block is collapsible. Slots that were required but missing render as `BLOCKED` strikethrough rows so the gap is visible. Sidecar materialization is its own block at the bottom with a tree of paths and a "Show on disk" link.

### 5.4 Fork-only additions

When this route is `/fork`:

- Target & profile pane gains a `Parent` section: a `ForkParent` summary card (`turn-ready-manifest #t42 · harness=claude · turnId=...`).
- Compiled preview pane adds a `Transfer decisions` table above the slot list:

  | Source part | Action | Target slot | Truth | Reason |
  | --- | --- | --- | --- | --- |
  | parent.decision-ledger.v3 | direct | decision-ledger | logged | identical |
  | parent.handoff-state | transform | handoff | reconstructed | claude has no native fork |
  | parent.sidecar.notes.md | harness-native | — | logged | passed via cwd |
  | parent.session-tail | drop | — | inferred | low signal |

  Drop and manual rows are highlighted; both require an explicit `reason` (per `TransferDecision`).

- The lineage strip (bottom of left pane, also shown small in launch) is the most important honesty surface in the product. It must label the lineage explicitly with one of:

  | Glyph | Label (mono pill) | Maps to |
  | --- | --- | --- |
  | `⌖` | `NATIVE FORK` | target harness creates parent-linked session from its own native data |
  | `≈` | `REPLAY FORK` | replay bundle compiled from manifest, new run started |
  | `▸` | `RECIPE-DERIVED` | prior state converted into a launch recipe |
  | `✎` | `MANUAL FORK` | human supplied missing state |

  These labels also appear on the right pane header so the agent reading the compiled preview cannot miss the lineage truth. Pill tone:
  - native fork → `ok`
  - replay fork → `info`
  - recipe-derived → `info`
  - manual fork → `warn`

  Never show "continued" / "resumed" — those imply hidden-state identity Contextual does not guarantee.

### 5.5 Plan record

Below the compiled preview, a collapsible "Plan record" block exposes the JSON `LaunchPlan` / `ForkPlan` (rendered through `studio/code` viewer). The developer can copy it; the agent can fetch it from `/api/launch/plan` etc. This is the durable artifact, the screen is just a viewer.

### 5.6 Action footer

Sticky bottom strip, mono, right-aligned:

- `View as agent ↗` (renders the same content with developer chrome stripped — useful for the agent ergonomics audit).
- `Save plan` (writes the `LaunchPlan` / `ForkPlan`, does not execute).
- Primary: `Instantiate` / `Fork` (disabled while `BLOCKED`; warns and confirms while `WARNINGS`).

Post-execution, the same page swaps to a read-only `InstantiationRecord` view with native session refs, outcome, errors, and a link to the resulting session in Explore.

### 5.7 Launch/Fork — open decisions

1. Should `View as agent` be a separate route or a toggle? Toggle is lower-overhead; route makes it easier to deep-link.
2. Replay bundle viewer — render inline in §5.5 or behind a "Open replay bundle" drawer? Recommend drawer; bundles are large.
3. Truth-label pill placement on Instantiated records (after the run): always render with same lineage glyph in Explore and in cartridge §2.7 lineage tree.

## 6. Cross-cutting components

Reusable primitives to land alongside these surfaces. All TypeScript-first, in `src/studio/` (so they can move to the `studio/` package later when stable).

| Component | Purpose | Notes |
| --- | --- | --- |
| `TruthChip` | render `logged | reconstructed | inferred | manual` | tones: ok / info / warn / neutral |
| `LineagePill` | render `native fork | replay fork | recipe-derived | manual fork` | glyph + mono caps, see §5.4 |
| `FreshnessDot` | small status dot driven by `FreshnessPolicy.stability` | reused in cartridge header and source rows |
| `TokenMeter` | linear meter, target vs max, required-vs-optional segments | used in profiles, planner, launch preflight |
| `ProvenanceList` | popover/list of `PackageProvenance[]` | rendered from part badge in §2.4 |
| `DecisionRow` | accept / omit / edit / defer affordance + reason note | planner stage + override paths in health/launch |
| `SourceRow` | uniform row used in cartridge §2.3, planner stage 3, health source table | columns vary by context but typography is shared |
| `CoverageGlyph` | `● ◐ ○ —` for coverage matrices and slot fit | mono, single accent |

All chips/pills route through `studio/atoms` `StatusPill` so dark/light themes flip automatically. Truth and lineage labels get their own component to lock the wording and prevent drift.

## 7. Visual & interaction rules

- One accent (`--scout-accent`); use it for the agent-authored proposal author chip, primary CTAs, and live token bars. Status uses `--status-{ok,warn,error,info,neutral}-fg`.
- No card shadows. Use the existing `bg-studio-rule` grid divider technique (`HealthStudyPage`) for grid layouts.
- Mono for: ids, hashes (always `[:8]`), tokens, scores, timestamps, file paths, lineage pills, eyebrows.
- Serif (`var(--studio-font-serif)`) for: intent paragraphs, stage charters, advisory "why" paragraphs.
- Tables are divider-only: top + bottom rules, row dividers, no zebra fills. Mono headers at 10px / 0.2em tracking.
- No hero. Page headers are kicker + H1 + one serif line, exactly as in `NorthStarPage` / `PresentationPage`.
- Truth and lineage labels never abbreviate to "ok / good / verified" — always use their explicit taxonomy term.
- Never use the word "continued" or "resumed" for a non-native fork. UI copy is part of the truth contract.

## 8. Implementation order (suggested)

1. Land the registry split: add `cartridges` bucket, `product` surface, `/studio/cartridges/[id]` slug routing.
2. Seed one real cartridge record (`agent-harness-context`) against the §2 contract — including parts, sources, profiles, freshness, evals, history.
3. Cartridge Detail page (§2) as the first read-only surface, since Planner and Launch both render its components.
4. Health Console (§4) — reuses Cartridge Detail's metric and source primitives; produces the first real recommendation.
5. Planner Workbench (§3) behind a `draft` cartridge — the heaviest surface; build stage-at-a-time, decisions ledger early.
6. Launch / Fork Preview (§5) — last, because it depends on `LaunchRecipe` / `LaunchPlan` compiler and `ForkPlan` API not yet landed.

## 9. Open decisions (consolidated)

1. Cartridge bucket vs cartridges-as-presentations: keep separate (recommended) so CTX presentations stay docs-flavored and cartridges stay product-flavored.
2. Cartridge `lifecycle` vs registry `status`: keep two fields. `lifecycle` describes the artifact; `status` describes the page.
3. Per-part provenance vs per-cartridge provenance default (recommend per-part with cartridge fallback for `draft`).
4. Agent author identity in planner: named (`@claude`, `@codex`) vs generic (`agent`). Recommend named.
5. Chat in planner: drop it (recommended) vs keep as collapsible drawer.
6. Eval suite gating: required for `published`, optional for `review` (recommended).
7. Lineage pill glyph set vs pure text: keep both (glyph + text). Glyph helps scanning, text is the truth.
8. `Acknowledge & launch anyway` reason field: required textarea (recommended) — every override is logged.
9. Live `View as agent` mode: toggle vs route (recommend toggle).
10. Where does the `EvalCase` library live: in cartridge or as a workspace-level registry? Recommend workspace-level registry with per-cartridge selection.

## 10. What I did not do

- No production code edits in this pass — operator asked for design directions, not Studio churn.
- No new icons; reused the existing `lucide-react` set already in `StudioPages.tsx`.
- No theme changes; spec stays within the current Studio token system.
- Did not rename existing studies (`planner-workbench`, `health-console`) — they're useful artifacts of the thinking and should stay until the live routes ship.
