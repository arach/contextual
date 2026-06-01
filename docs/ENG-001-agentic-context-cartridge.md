# ENG-001: Agentic Context Cartridge

Status: approved
Owner: Contextual
Last updated: 2026-05-31

## Summary

Contextual's primary planning artifact is a `ContextCartridge`.

A cartridge is a versioned, source-backed object that records the context a future agent session should start with. It is not a transcript dump and not a hidden-memory snapshot. It is the durable artifact produced by agentic context planning: intent, scope, sources, parts, load profiles, freshness, provenance, evals, and target launch/fork compatibility.

## Problem

The old package concept is too vague. It can mean a bag of modules, a UI grouping, a prompt fragment, or a reusable context bundle. That ambiguity makes it hard to build reliable launch and fork mechanics.

The product needs one precise unit that can answer:

- What job is this context preparing an agent to do?
- Which sources are allowed to support its claims?
- Which context parts are required, optional, stale-prone, or target-specific?
- Which profile should a target agent load?
- Is this starter context healthy enough to launch?
- What lineage can Contextual truthfully claim after launch or fork?

## Decision

Introduce `ContextCartridge` as the first-class domain object for planned agent starting context.

The cartridge replaces "package" in product-facing language. Existing runtime names such as `Thread`, `session`, `designer`, and `ContextPackage` can remain until persistence and route contracts are ready to migrate.

## Goals

- Give Contextual a stable artifact for agentic context planning.
- Make every cartridge source-backed and audit-friendly.
- Support multiple load profiles from one curated artifact.
- Enable health checks before launch or fork.
- Give agents a compact, typed object they can compile into launch and fork plans.
- Keep source truth distinct from interpretation.

## Non-Goals

- Exact reconstruction of provider-hidden prompts, memory, caches, or compression state.
- A universal provider message format.
- Runtime execution of launch/fork plans in this proposal.
- Full persistence migration from prototype seed data.
- Renaming existing persisted mode ids.

## Domain Model

The initial TypeScript contract lives in `src/lib/contextCartridge.ts`.

```ts
interface ContextCartridge {
  id: string;
  name: string;
  version: string;
  lifecycle: CartridgeLifecycle;
  owner: string;
  intent: string;
  objectives: string[];
  scope: CartridgeScope;
  targets: LaunchTarget[];
  sources: CartridgeSource[];
  parts: CartridgePart[];
  profiles: LoadProfile[];
  freshness: FreshnessPolicy;
  evals: EvalCase[];
  history: CartridgeHistoryEntry[];
  planner: PlannerStage[];
  health: HealthSummary;
  plans: {
    launch: CartridgePlan;
    fork: CartridgePlan;
  };
}
```

### Lifecycle

Cartridge lifecycle is artifact state, not Studio page state:

| State | Meaning |
| --- | --- |
| `draft` | Editable planning artifact; incomplete stages allowed |
| `review` | Structurally complete; launch allowed with warnings |
| `published` | Validated, eval suite has passed at least once |
| `archived` | Read-only historical artifact |

### Truth Labels

Every source and part must use one explicit truth label:

| Label | Meaning |
| --- | --- |
| `logged` | Directly backed by native logs, repo files, docs, or sidecars |
| `reconstructed` | Derived from logged evidence but not directly present |
| `inferred` | Agent or developer inference from available evidence |
| `manual` | Human-authored note without machine-verifiable source |

Truth labels are not cosmetic. They drive health scoring, launch warnings, and fork lineage claims.

## Cartridge Structure

### Intent

The intent is the human-readable contract for what this cartridge prepares. It should be free-form text plus structured `objectives[]`.

Reason: the intent needs to be readable in Studio, but objectives need to survive planning, eval selection, and launch compilation.

### Scope

`CartridgeScope` describes the workspace boundary:

- `kind`: repo, directory, or global
- `path`: workspace root or durable location
- `branchHint`: optional branch/worktree hint

Scope is deliberately small in ENG-001. ENG-003 expands how Contextual sculpts and validates scope/boundary decisions.

### Sources

`CartridgeSource[]` is the source map. A source can be a session, doc, reconstruction, manual note, code file, or sidecar.

Every source records:

- stable id
- name
- family
- path or ref
- observed time
- truth label
- coverage note
- health state
- optional Explore deep link

Source rows should be shown before parts in cartridge detail pages. This keeps the product honest: the tool shows where truth comes from before showing the distilled context.

### Parts

`CartridgePart[]` is the ordered body of the cartridge. Parts are the material that profiles and launch plans compile.

Each part records:

- order
- kind
- title
- required flag
- body
- token estimate
- truth label
- freshness stability
- compatible targets
- source ids
- per-part provenance

Parts are ordered because launch order matters. The UI should render them as a vertical ordered list, not a card grid.

### Profiles

Each cartridge compiles into load profiles:

| Profile | Product job |
| --- | --- |
| `briefing` | Minimal fresh-session starter context |
| `working-set` | Default build/design/review working context |
| `deep-pack` | Larger audit or implementation context |

Profiles choose part ids and token budgets. A profile can be blocked even when the cartridge exists if required parts are stale, missing, incompatible, or over budget.

### Freshness

Freshness is both cartridge-level and part-level.

Cartridge-level `FreshnessPolicy` records:

- stability
- refresh deadline
- invalidation events
- optional refresh command

Part-level freshness records whether each part is durable, session-local, or stale-prone.

### Evals

`EvalCase[]` records whether the cartridge's claims have been tested. The initial eval library should include:

- native-vs-replay-fork
- memory-boundary
- context-handoff
- source-truth-claims

Publishing should require at least one passing run of the selected eval suite. Review state can allow warnings.

## Storage

Prototype data currently lives in `src/data/contextCartridges.ts`.

The durable store should move under `~/.contextual`:

```txt
~/.contextual/
  cartridges/
    <cartridge-id>/
      cartridge.json
      versions/
        v0.1.json
        v0.2.json
      health/
        latest.json
      plans/
        launch.json
        fork.json
```

Rules:

- `cartridge.json` points to the active version.
- versions are immutable after write.
- health and plans are derived records that can be recomputed.
- source refs point back to native logs, docs, sidecars, or Explore records.

## API Shape

The first server routes should be read-first:

```txt
GET /api/cartridges
GET /api/cartridges/:id
GET /api/cartridges/:id/health
GET /api/cartridges/:id/plans/launch
GET /api/cartridges/:id/plans/fork
```

Mutation routes should wait until the planner contract in ENG-004 is stable:

```txt
POST /api/cartridges
POST /api/cartridges/:id/versions
POST /api/cartridges/:id/health/recompute
POST /api/cartridges/:id/plans/launch
POST /api/cartridges/:id/plans/fork
```

## Validation

Validation should fail a cartridge publish when:

- id, name, intent, scope, or owner are missing
- a part has no source ids and no explicit manual truth label
- a required part has no provenance
- a profile references a missing part
- a target is unsupported but included in a launch profile
- freshness is stale beyond policy and no override exists
- selected evals have never run
- fork plans claim native lineage without native parent evidence

Review state can allow warnings. Published state should not.

## UI Requirements

The cartridge detail route must render from the typed object:

```txt
/studio/cartridges/:id
```

Minimum visible sections:

- header with lifecycle, version, owner, scope, refresh date
- intent and objectives
- source map
- ordered parts
- load profiles and token meters
- freshness
- eval state
- version history
- links to planner, health, launch, and fork

## Implementation Plan

1. Keep the seed cartridge in TypeScript until the store shape stabilizes.
2. Add read-only API routes that return the seed cartridge.
3. Add a validation module with draft/review/publish modes.
4. Move the seed cartridge into `~/.contextual/cartridges`.
5. Add immutable version write support.
6. Wire Studio to read from API instead of local imports.
7. Gate launch/fork previews on validation result.

## Risks

- The contract can become too large if every launch-plan concern lands in the cartridge. Keep executable plan records derived.
- Product copy can drift back to generic "package" language. Keep cartridge as the user-facing noun.
- Manual sources can become a loophole. Manual truth must be explicit and lower confidence in health scoring.
- Published cartridges can become stale. Freshness policy must produce concrete refresh/block decisions.

## Acceptance Criteria

- `ContextCartridge` is the typed source of truth for cartridge detail, planner, health, launch, and fork previews.
- The seed `agent-harness-context` cartridge validates at `review`.
- Every required part has provenance.
- Every profile compiles to a known set of parts and token totals.
- Health can produce one recommendation from cartridge data.
- Launch/fork plans use cartridge parts and preserve lineage truth labels.
