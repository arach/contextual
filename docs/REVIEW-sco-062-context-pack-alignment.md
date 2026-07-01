# REVIEW: SCO-062 — Context-Pack Alignment (from Contextual)

Status: review notes
Reviewer: Contextual
Date: 2026-06-04
Source reviewed: `/Users/arach/dev/openscout/docs/eng/sco-062-qmd-knowledge-search-and-context-index.md`
Contextual references:
- `docs/CONTRACT-session-package.md` (`contextual.package.v1`)
- `docs/CONTRACT-launch-and-fork.md` (`contextual.recipe.v1`, `contextual.fork-plan.v1`)
- `src/lib/contextDesign.ts` (live `ContextDesign` / `DesignPart` / `RunPlan` types)
- `docs/HARNESS-CONTRACT.md` (`HarnessSessionKey`, manifest truth labels)

## TL;DR verdict

The proposal is well-aligned and the boundary is drawn in the right place. QMD-as-derived-projection / source-as-authority is exactly how Contextual already thinks (at-rest JSONL is authority; turn-ready manifest and contextual atoms are projections — see `HARNESS-CONTRACT.md`). Five things will keep the two systems composable instead of entangled:

1. **Treat a context pack as authoritative *source material*, not as something Scout authors.** The QMD `context-packs` collection is a derived, searchable projection of an external pack — never the canonical pack.
2. **Make the soft dependency concrete via a vendor-neutral `ContextPackManifest` + delegation**, not via importing Contextual code. Scout reads the manifest; for fork it *delegates* to the pack's declared producer when one exists, else does a clearly-labeled best-effort fork.
3. **Do not reinvent fork semantics.** Contextual already specifies fork honesty labels (`native` / `replay` / `recipe` / `manual`) and "plan before execute." `context_pack_fork` should inherit both, not grow a parallel model.
4. **Preserve provenance, freshness, and token budget through the projection** — these are the parts most likely to be silently dropped, and they are Contextual's core value.
5. **Resolve pack requirements against the skills/MCP collections** Scout is already building — packs declare `requires.skills` / `requires.mcpCapabilities`, so the adapters compose.

No blocking objections. Everything below is additive.

---

## 1. Layering: authority vs projection (the core principle)

SCO-062's own thesis — "QMD is the durable derived knowledge layer… Raw source material remains the authority for exact evidence" — should be applied to context packs verbatim:

| Layer | Owner | Example |
| --- | --- | --- |
| Authoritative pack | producer (Contextual / hand-authored / future tool) | `contextual.package.v1` `SessionPackage`, or a `.contextual/packs/*.json` manifest |
| QMD `context-packs` collection | Scout (`derived`) | `purpose.md`, `included-context.md`, `fork-policy.md`, `chunks/` |
| FTS / vector / facets | Scout (`derived`, rebuildable) | search hits |

Consequence for the data-ownership section (which already lists "external Contextual assets" under *observes/references*): the QMD docs for a Contextual-backed pack are `derived`, but the **manifest/pack the source ref points at is `observed_source`**, and Scout must not mutate it. Editing a pack inside Scout produces a *new* `scout_owned` pack (a fork-of-pack) — it must not write back into the observed Contextual asset. This is the same rule as "MUST NOT treat observed source material as broker-owned conversation state," applied to packs.

## 2. The soft-dependency mechanism

To keep Contextual a *soft* dependency (Phase 5.4 + the acceptance criterion), the contract between the systems should be **a file the producer emits, plus an optional delegation endpoint** — never a runtime import.

- The `context-packs` adapter reads a `ContextPackManifest` (shape in §3). It works with zero Contextual runtime present: index + search + facets all function from the manifest alone.
- Fork degrades gracefully:
  - If `manifest.fork.method === "external"` and `manifest.origin.forkEndpoint` resolves (Contextual runtime detected) → Scout POSTs to Contextual's `/api/forks/plan` then `/api/forks/execute` and records the returned `InstantiationRecord` ref as a source ref.
  - Otherwise → Scout produces its own recipe fork from `manifest.parts` and labels it best-effort (`recipe-derived launch`), with a visible warning "Contextual runtime not detected — best-effort fork from manifest."
- Keep the source kind generic: `context_pack`, **not** `contextual_pack`. `manifest.schemaVersion` (`contextual.package.v1` vs `scout.context-pack.v1`) is the discriminator. This is the single guardrail that prevents a hard dependency from leaking into the type system.

## 3. Concrete schema — `ContextPackManifest`

This is the answer to your open decision *"What is the minimum manifest schema needed before context packs can launch forked sessions?"* It is a vendor-neutral **subset projection** of Contextual's `SessionPackage` (`CONTRACT-session-package.md`) plus a fork-capability block. Contextual can emit it directly; a human can hand-author it; Scout can synthesize it for a user-curated pack.

```ts
export interface ContextPackManifest {
  schemaVersion: string;            // discriminator: "contextual.package.v1" | "scout.context-pack.v1" | ...
  id: string;
  version: string;
  title: string;
  description: string;
  lifecycle: "draft" | "review" | "published" | "archived";
  taskClass?: string;               // Contextual `intent` — class of work this pack prepares

  origin: {
    producer: "contextual" | "scout" | "manual" | string;
    sourcePath?: string;            // authoritative pack location (NOT copied into knowledge/qmd)
    forkEndpoint?: string;          // producer API/CLI to delegate fork to, when method = "external"
  };

  workspace: {                      // = Contextual WorkspaceScope; gate for "safe to apply here"
    kind: "repo" | "directory" | "global";
    repoRemote?: string;
    branchHint?: string;
  };

  targets: Array<{                  // = Contextual LaunchTarget[] / compatibleTargets
    harness: string;                // "codex" | "claude" | "pi" | "pi-ai" | "opencode" | ...
    model?: string;
    provider?: string;
    compatibility: "native" | "compatible" | "transform-required" | "unsupported";
  }>;

  budget?: { targetTokens: number; maxTokens: number };   // do not drop — see §8
  profiles?: Array<{ id: string; tokenTarget: number; partIds: string[] }>; // briefing/working-set/deep-pack

  freshness: {                      // = Contextual FreshnessPolicy
    stability: "durable" | "session-local" | "stale-prone";
    refreshBy?: string;
    invalidatesOn?: string[];
    refreshCommand?: string;
  };

  requires?: { skills?: string[]; mcpCapabilities?: string[] };  // resolved against skills/mcp collections (§7)

  parts: Array<{
    id: string;
    kind: string;                   // task-brief | repo-map | decision-ledger | source-digest | launch-policy | ...
    title: string;
    required: boolean;
    tokens: number;
    truth: "logged" | "reconstructed" | "inferred" | "manual";
    freshness: "durable" | "session-local" | "stale-prone";
    sourceRef?: KnowledgeSourceRef; // a part may itself trace back to a session/file (§6, §10)
  }>;

  fork: {
    method: "external" | "recipe" | "replay" | "native" | "manual";
    label: string;                  // honesty label rendered in UI (see §4)
    delegatesTo?: string;           // mirrors origin.forkEndpoint when method = "external"
  };
}
```

**Minimum required to launch a fork:** `id`, `version`, `schemaVersion`, `workspace`, `targets`, `parts` (each with `sourceRef` where the part is derived), `fork`, and `freshness`. `budget`/`profiles`/`requires` are strongly recommended but not blocking.

## 4. Fork / launch API alignment

Contextual's launch/fork contract already encodes two disciplines Scout should inherit rather than redesign:

**(a) Plan before execute.** Contextual lands planning routes before execution routes (`/api/launch/plan`, `/api/forks/plan` → `/api/launch/instantiate`, `/api/forks/execute`). Recommend splitting your MCP surface the same way:

- `context_pack_search` — pure Scout FTS over QMD. Good as proposed.
- `context_pack_plan_fork` *(new)* — dry run. Returns transfer decisions, token estimate vs target window, freshness/preflight warnings, and the honesty label. No session created.
- `context_pack_fork` — execute, only after a plan exists.

This mirrors Contextual's `LaunchPlan` (`tokenBudget.estimatedInputTokens` / `maxInputTokens`, `warnings`, `blockedBy`) and the rule "Plans are auditable… saved before execution."

**(b) Fork honesty labels.** Contextual defines four (`CONTRACT-launch-and-fork.md`): native fork, replay fork (`replayed from manifest`), recipe fork (`recipe-derived launch`), manual fork — and the hard rule "UI labels never imply exact continuation when the target is a replay or reconstruction." A Scout-authored best-effort fork from a manifest is, in Contextual's taxonomy, a **recipe fork** — label it as such. Do not invent a fifth, unlabeled "context-pack fork" that implies more fidelity than a manifest projection can deliver. This is the single behavior most likely to regress if Scout rolls its own fork model.

**Preflight.** Reuse Contextual's preflight list for `context_pack_plan_fork`: target harness installed/authenticated, target cwd exists and is allowed (gated by `workspace`), required parts available, **stale-prone parts refreshed or acknowledged**, token budget below target window, transfer decisions reviewed when action is `drop`/`manual`.

## 5. Enriched `context_pack` source ref

The current variant is too coarse for drilldown + fork:

```ts
| { kind: "context_pack"; path: string; packId?: string }
```

Suggested enrichment (parallel to how `harness_transcript` carries `recordRange`):

```ts
| { kind: "context_pack";
    path: string;            // authoritative manifest path (origin.sourcePath)
    packId?: string;
    version?: string;
    schemaVersion?: string;  // lets a hit declare "contextual.package.v1" without loading the pack
    partId?: string;         // chunk → the specific pack part it was derived from
    forkEndpoint?: string }  // delegation hint surfaced on the hit, enables one-click plan-fork
```

`partId` is what lets a search hit drill into *one* part of a pack rather than the whole manifest, and lets the fork planner map QMD chunks back to `manifest.parts[]` for transfer decisions.

## 6. Facet vocabulary for packs

To answer "which reusable context pack should a new session fork from?", standardize these facets on the `context-packs` collection (all sourced directly from manifest fields):

| Facet | Source | Default behavior |
| --- | --- | --- |
| `taskClass` / `intent` | `manifest.taskClass` | free text + suggested values |
| `harness` | `targets[].harness` | multi |
| `model` / `provider` | `targets[]` | multi |
| `workspaceKind` / `repoRemote` | `manifest.workspace` | gate "applies to this repo" |
| `lifecycle` | `manifest.lifecycle` | **default search/fork to `published` only** (mirror Contextual; `draft`/`review` packs are not default fork sources) |
| `freshness` | `manifest.freshness.stability` | flag `stale-prone` in results |
| `requiresSkill` / `requiresCapability` | `manifest.requires` | enables cross-adapter resolution (§7) |
| `loadProfile` | `manifest.profiles[].id` | briefing / working-set / deep-pack |
| `maxTokens` | `manifest.budget.maxTokens` | range filter |

This lets the existing FTS5 facet engine answer "published Claude packs for this repo, under 40k tokens, that need the `debug` skill" with no embedding layer.

## 7. Cross-adapter synergy (don't miss this)

Packs declare `requires.skills` and `requires.mcpCapabilities`. Scout is *already* indexing skills and MCP tools as QMD collections (Phase 4). So pack requirements should be **resolved as cross-collection source refs**, not re-described:

- `context_pack_plan_fork` resolves `requires.skills[]` against the `skills` collection → "needs `debug` skill — installed? yes/no."
- It resolves `requires.mcpCapabilities[]` against the `mcp` collection / capability registry (sco-040) → "needs capability `fs.write` — exists? available to this actor?" Permission evaluation stays in broker/capability-registry, exactly as your MCP section says.

This is also the strongest argument for your open decision *"separate skill/MCP filters vs unified 'capabilities' group"*: from the pack angle, **unified** is better — a pack's preflight wants one capability surface to resolve against, not two.

## 8. Things not to lose in the projection

- **Token budget / load profiles.** Contextual's value is *budgeted* assembly (briefing / working-set / deep-pack, `targetTokens` / `maxTokens` — `src/lib/contextDesign.ts:75`). If a fork just concatenates `included-context.md`, budgeting is lost. Carry `budget` + `profiles` in the manifest and show estimated tokens vs target window in the fork plan. Scout should not re-implement budgeting; surface the pack's profiles and let the producer compile, or warn on a naive fork.
- **Provenance.** Contextual parts carry `provenance[]` (`contentHash`, `observedAt`, `truth`, `sourceIds`). Keep `truth` per part in the manifest and reflect it on hits, so a result can say "decision-ledger part = `reconstructed`, not `logged`."
- **Freshness gating.** A `stale-prone` pack must surface as stale in search *and* trip preflight on fork — never launch silently from stale context.

## 9. Drilldown closes the loop with the sessions adapter

Your retrieval section lists "context-pack manifest" as a drilldown target. Extend it: because a Contextual pack's parts carry `sourceRef` back to the sessions they were distilled from (`provenance.sessionId` / `harnessSessionKey`), a user can drill **pack → the sessions it was built from → raw transcript record range**. That chains the `context-packs` adapter into the `sessions` adapter through the shared `KnowledgeSourceRef` model — a concrete payoff for keeping one source-ref type across adapters, and a good demo for the "retrieval and launch layer" thesis.

## 10. Answers to your Open Decisions (pack-relevant ones)

- **Minimum manifest schema before forking** → §3 `ContextPackManifest`; minimum required fields listed there. The fork-enabling additions over your current sketch are `fork` + `origin.forkEndpoint` + per-part `sourceRef`.
- **Where do QMD collections live** → the QMD projection for packs lives under `controlHome/knowledge/qmd/<id>` (Scout-owned, rebuildable). The **authoritative manifest must NOT** be copied there — it stays at `origin.sourcePath`; the source ref points to it. State this explicitly so authoritative packs aren't accidentally absorbed into knowledge/qmd.
- **Separate vs unified skill/MCP search** → unified "capabilities" group, for the pack-requirement-resolution reason in §7.
- **Default-enabled adapters after sessions** → from the pack angle, enable `skills` + `mcp` before `context-packs`, because pack preflight depends on resolving requirements against them.

## 11. Suggested additions to Phase 5 acceptance criteria

- A pack can be indexed, searched, and faceted with **no Contextual runtime present**.
- `context_pack_plan_fork` returns a previewable plan (transfer decisions + token estimate + honesty label + resolved skill/MCP requirements) **before** any session is created.
- Fork honesty labels match Contextual's taxonomy; a manifest-derived fork is labeled `recipe-derived launch`, never implied as exact continuation.
- A stale-prone pack trips preflight on fork.
- Editing a Contextual-backed (`observed_source`) pack inside Scout creates a new `scout_owned` pack and never mutates the observed asset.
- A pack hit can drill down to the sessions/transcripts its parts were derived from via shared source refs.
