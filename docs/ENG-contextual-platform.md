# ENG: Contextual Platform

Status: active vision
Owner: Contextual
Last updated: 2026-05-30

## Thesis

Contextual is an agentic context planning tool. Its job is to help developers and agents plan, validate, and launch the context a session should start with, while preserving the provenance of how that starting position was made.

It should not compete with model providers or harnesses on hidden in-flight context management. Providers and harnesses increasingly own server-side caching, compression, memory, and session reconstruction. Contextual's durable boundary is before a run starts and when a run is deliberately forked, cloned, packaged, or replayed.

## Organizing Principles

1. Plan before launch. Contextual should make the intended starting context explicit before an agent spends a turn.
2. Artifacts over chat. The planning conversation should compile into cartridges, plans, evals, and records instead of staying trapped in a transcript.
3. Source truth first. Native records, docs, sidecars, and manual notes must stay distinguishable from interpretation.
4. Profiles, not monoliths. A cartridge should compile into briefing, working-set, and deep-pack profiles for different agents and jobs.
5. Health gates every launch. Efficiency, freshness, coverage, provenance, and evals should produce a keep, refresh, rebuild, or block recommendation.
6. Forks are lineage claims. Contextual must label native forks, replay forks, recipe-derived starts, and manual forks honestly.
7. Agent-readable is a product requirement. Every developer surface should produce a stable object or plan an agent can consume.

## Product Verbs

| Verb | Primary user | Close second | Product job |
| --- | --- | --- | --- |
| Explore | Developer | Agent | Inspect prior sessions, native records, turn manifests, atoms, decisions, and stale context |
| Package | Developer | Agent | Distill reusable context into versioned artifacts with provenance and freshness rules |
| Instantiate | Agent | Developer | Compile packages and recipes into a launch plan for a target harness/model/workspace |
| Fork | Agent | Developer | Derive a new run from a prior manifest or run with explicit lineage and transfer decisions |

Developer-first does not mean manual-only. Explore and Package should produce machine-usable artifacts. Agent-first does not mean invisible. Instantiate and Fork must be auditable, previewable, and reversible by the developer.

## Surfaces

### Studio

Studio is the developer-first Hudson AppShell surface. It contains:

- Explore: session catalog, at-rest records, turn-ready manifests, Contextual atoms/buckets/slices.
- Package: cartridge planner, provenance review, freshness policy, compatibility preview.
- Launch preview: recipe slots, token budgets, target harness warnings, materialized sidecars.
- Fork review: manifest diff, transfer decisions, lineage, expected truth level.

### Runtime

Runtime is the agent-first machine surface. It exposes stable artifacts and APIs:

- package manifests
- launch recipes
- launch plans
- instantiation records
- fork plans
- replay bundles
- harness catalogs and turn-ready manifests

The agent should ask Contextual to prepare or fork a run. It should not rely on Contextual to mutate a hidden live provider buffer.

## Data Ladder

Contextual separates ground truth from interpretation:

```txt
native transcript / sidecars
  -> at-rest lines
  -> turns
  -> turn-ready manifests
  -> atoms
  -> slices
  -> blocks
  -> packages
  -> launch recipes
  -> launch plans
  -> instantiated runs / forks
```

The lower layers preserve what exists. The upper layers explain, curate, and compile.

## Truth And Provenance Rules

- Native records stay native. Do not rewrite harness JSON into a pretend universal message format.
- Turn-ready manifests must label every part as logged, reconstructed, inferred, or unavailable.
- Contextual atoms and buckets are proprietary interpretation, not provider taxonomy.
- Package parts must preserve source refs, content hashes, and freshness policy.
- Instantiation must be labeled as launch, replay, or fork. Do not call a replay an identical continuation.
- Claude prompt reconstruction stays best-effort unless Claude logs more prompt assembly data.

## Architecture

```txt
Hudson AppShell Studio
  Explore / Package / Launch Preview / Fork Review
        |
        v
Contextual server modules
  session-analysis  harnesses  packages  launch  fork
        |
        v
Harness adapters
  Codex  Claude Code  Pi  pi-ai
        |
        v
Local stores
  ~/.codex  ~/.claude  ~/.contextual  worktrees
```

Existing code already supports the lower half:

- `src/server/harnesses`: harness-neutral catalog, at-rest, turns, manifests.
- `src/lib/harnessContract.ts`: wire contract for the harness read API.
- `src/server/session-analysis`: Contextual atom and recipe-draft interpretation.
- `src/components/analysis`: Explore workbench with at-rest, turn-ready, and contextual modes.

The next architecture layer should add:

- cartridge store and cartridge schema validation
- recipe compiler from cartridges and Contextual blocks
- launch planner and materializer
- fork planner based on manifest diffs and transfer decisions

## Domain Objects

Existing stable objects:

- `HarnessSessionRef`
- `AtRestLine`
- `TurnRecord`
- `TurnReadyManifest`
- `ManifestPart`
- `SidecarFile`
- `ContextAtom`
- `ContextSlice`
- `ContextBlock`
- `RecipeDraft`

Target platform objects:

- `ContextCartridge`
- `PackageVersion`
- `PackagePart`
- `PackageProvenance`
- `FreshnessPolicy`
- `BudgetProfile`
- `LaunchRecipe`
- `LaunchPlan`
- `InstantiationRecord`
- `ForkPlan`
- `ReplayBundle`
- `ManifestDiff`
- `TransferDecision`

## Storage Layout

Target local store under `~/.contextual`:

```txt
~/.contextual/
  session-catalog.json
  packages/
    <package-id>/
      package.json
      versions/
  recipes/
    <recipe-id>.json
  launches/
    <launch-id>/
      plan.json
      record.json
      sidecars/
  forks/
    <fork-id>/
      plan.json
      replay-bundle.json
  sessions/
  workspaces/
```

The store should be append-friendly and inspectable. Derived indexes can be rebuilt from package, recipe, launch, and fork records.

## Near-Term Engineering Plan

1. Keep Explore grounded in the harness read kernel.
2. Promote packages from prototype UI data into a validated artifact contract.
3. Compile `RecipeDraft` blocks into `LaunchRecipe` slots.
4. Add launch plan and fork plan routes before adding execution routes.
5. Move live dispatch and branch routes into Next only if they are reframed as instantiation and fork primitives.

## Non-Goals

- Exact hidden prompt reconstruction across all harnesses.
- In-flight mutation of provider memory, caches, or compressed state.
- A generic chat wrapper over every provider.
- Broad renames of existing `Thread`, `Branch`, or `SessionAnalysis` types before the contracts are stable.
