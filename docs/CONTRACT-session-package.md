# CONTRACT: Session Package

Status: draft
Owner: Contextual
Last updated: 2026-05-30

## Purpose

A session package is a versioned, reusable context artifact. It is built from explored sessions, docs, sidecars, and curated blocks. It is not a live conversation and it is not a raw transcript dump.

Packages answer: "What durable context should a future agent start with for this class of work?"

## Lifecycle

```txt
draft -> review -> published -> archived
```

- `draft`: editable and allowed to have unresolved provenance warnings.
- `review`: complete enough for preview, but not default for agent launches.
- `published`: stable version agents can consume.
- `archived`: retained for lineage, not offered by default.

## Target Shape

```ts
export interface SessionPackage {
  schemaVersion: "contextual.package.v1";
  id: string;
  version: string;
  name: string;
  description: string;
  lifecycle: "draft" | "review" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
  owner?: string;
  tags: string[];
  workspaceScope: WorkspaceScope;
  budget: BudgetProfile;
  freshness: FreshnessPolicy;
  compatibility: HarnessCompatibility[];
  sources: PackageSource[];
  parts: PackagePart[];
  history: PackageHistoryEntry[];
}
```

## Core Fields

### Workspace Scope

```ts
export interface WorkspaceScope {
  kind: "repo" | "directory" | "global";
  path?: string;
  repoRemote?: string;
  branchHint?: string;
}
```

The scope tells Runtime whether a package is safe to apply in the current workspace.

### Budget Profile

```ts
export interface BudgetProfile {
  targetTokens: number;
  maxTokens: number;
  priority: "required" | "recommended" | "optional";
}
```

The budget is a packaging constraint, not a guarantee that every target harness will receive every part.

### Freshness Policy

```ts
export interface FreshnessPolicy {
  stability: "durable" | "session-local" | "stale-prone";
  refreshBy?: string;
  refreshCommand?: string;
  invalidatesOn?: string[];
}
```

Stale-prone parts must be checked during launch planning.

### Compatibility

```ts
export interface HarnessCompatibility {
  harness: "codex" | "claude" | "pi" | "pi-ai";
  status: "native" | "compatible" | "transform-required" | "unsupported";
  notes?: string[];
}
```

Compatibility is per package and can be overridden per part.

## Package Parts

```ts
export type PackagePartKind =
  | "instruction"
  | "task-brief"
  | "repo-map"
  | "decision-ledger"
  | "verification-summary"
  | "handoff-state"
  | "sidecar"
  | "reference"
  | "discard-note";

export interface PackagePart {
  id: string;
  kind: PackagePartKind;
  title: string;
  body: string;
  tokens: number;
  required: boolean;
  order: number;
  provenance: PackageProvenance[];
  freshness?: FreshnessPolicy;
  compatibility?: HarnessCompatibility[];
}
```

Parts are the unit of ordering, provenance, freshness checks, and transfer decisions.

## Provenance

```ts
export interface PackageProvenance {
  sourceId: string;
  sessionId?: string;
  harnessSessionKey?: string;
  manifestPartId?: string;
  atomId?: string;
  sliceId?: string;
  blockId?: string;
  path?: string;
  contentHash: string;
  observedAt: string;
  truth: "logged" | "reconstructed" | "inferred" | "manual";
}
```

Every non-manual package part needs at least one provenance entry. Manual parts must say they are manual.

## Validation Rules

- `id`, `version`, `schemaVersion`, `name`, `lifecycle`, `parts`, and `sources` are required.
- Published packages must have no required part with missing provenance.
- Required parts must fit inside `budget.maxTokens`.
- `contentHash` must be computed from the stored part body or referenced sidecar.
- Stale-prone required parts must define a refresh command, invalidation rule, or explicit review note.
- Harness compatibility must never overstate transfer quality. Use `transform-required` when exact native transfer is not available.

## Relationship To Current Code

Current prototype data lives in `src/data/packages.ts` as `ContextPackage`. That type is useful as UI seed data, but it lacks provenance, freshness, lifecycle, and compatibility. The first implementation should either extend it toward this contract or introduce a separate persisted package type and adapt the UI.
