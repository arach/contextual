# CONTRACT: Launch And Fork

Status: draft
Owner: Contextual
Last updated: 2026-05-30

## Purpose

Launch and fork are Runtime primitives. They turn packages, recipes, manifests, and prior runs into a concrete starting position for an agent.

Launch answers: "How should this agent start?"
Fork answers: "How should this agent continue from that prior state without pretending it is the same hidden session?"

## Launch Recipe

A launch recipe is an ordered context plan. It can be generated from packages, session analysis blocks, or a human-authored handoff.

```ts
export interface LaunchRecipe {
  schemaVersion: "contextual.recipe.v1";
  id: string;
  title: string;
  target: LaunchTarget;
  packageRefs: PackageRef[];
  slots: LaunchRecipeSlot[];
  policy: LaunchPolicy;
}

export interface LaunchTarget {
  harness: "codex" | "claude" | "pi" | "pi-ai";
  cwd: string;
  model?: string;
  provider?: string;
}

export interface LaunchRecipeSlot {
  id: string;
  kind:
    | "task-brief"
    | "instructions"
    | "repo-map"
    | "working-set"
    | "decision-ledger"
    | "verification"
    | "handoff"
    | "sidecars";
  required: boolean;
  targetMinTokens: number;
  targetMaxTokens: number;
  partRefs: string[];
  freshness: "durable" | "session-local" | "stale-prone";
}
```

## Launch Plan

A launch plan is the compiled preview for a specific target harness and workspace.

```ts
export interface LaunchPlan {
  schemaVersion: "contextual.launch-plan.v1";
  id: string;
  recipeId: string;
  target: LaunchTarget;
  status: "ready" | "blocked" | "warnings";
  generatedAt: string;
  tokenBudget: {
    estimatedInputTokens: number;
    maxInputTokens: number;
  };
  materialization: MaterializationStep[];
  promptParts: LaunchPromptPart[];
  warnings: LaunchWarning[];
  blockedBy: LaunchBlocker[];
}
```

Plans are auditable. They should be saved before execution so a later run can prove how it was started.

## Instantiation Record

An instantiation record is written after execution.

```ts
export interface InstantiationRecord {
  schemaVersion: "contextual.instantiation.v1";
  id: string;
  launchPlanId: string;
  createdAt: string;
  target: LaunchTarget;
  harnessSessionKey?: string;
  nativeSessionId?: string;
  workspacePath?: string;
  sidecarPaths: string[];
  firstPromptHash?: string;
  outcome: "created" | "partial" | "failed";
  errors: string[];
}
```

## Fork Plan

A fork plan starts from a previous manifest, run, or instantiation record.

```ts
export interface ForkPlan {
  schemaVersion: "contextual.fork-plan.v1";
  id: string;
  parent: ForkParent;
  target: LaunchTarget;
  generatedAt: string;
  lineage: LineageRef[];
  transferDecisions: TransferDecision[];
  replayBundleId?: string;
  launchPlanId?: string;
  status: "ready" | "blocked" | "warnings";
  warnings: LaunchWarning[];
}

export interface ForkParent {
  kind: "turn-ready-manifest" | "instantiation" | "native-session";
  id: string;
  harnessSessionKey?: string;
  turnId?: string;
}

export interface TransferDecision {
  sourcePartId: string;
  action: "direct" | "transform" | "harness-native" | "drop" | "manual";
  targetSlotId?: string;
  reason: string;
  truth: "logged" | "reconstructed" | "inferred" | "manual";
}
```

## Fork Semantics

Forks must preserve lineage but avoid false continuity.

| Fork type | Meaning | Label |
| --- | --- | --- |
| Native fork | Target harness creates a parent-linked session from its own native data | `native fork` |
| Replay fork | Contextual compiles a replay bundle from a manifest and starts a new run | `replayed from manifest` |
| Recipe fork | Contextual converts selected prior state into a launch recipe | `recipe-derived launch` |
| Manual fork | Human supplies missing state or edits transfer decisions | `manual fork` |

When exact hidden provider state is unavailable, the fork remains useful but must be labeled as replayed or best-effort.

## Proposed Routes

Planning routes should land before execution routes:

```txt
POST /api/launch/plan
POST /api/forks/plan
POST /api/manifests/diff
```

Execution routes:

```txt
POST /api/launch/instantiate
POST /api/forks/execute
```

## Preflight Checks

- target harness installed and authenticated
- target cwd exists and is allowed
- required package parts available
- stale-prone parts refreshed or acknowledged
- token budget below target model window
- sidecars materializable
- transfer decisions reviewed when action is `drop` or `manual`

## Acceptance Criteria

- A launch plan can be generated without creating a native session.
- A fork plan can explain every transfer decision from source manifest to target launch slot.
- Instantiation writes a durable record with native session refs when available.
- UI labels never imply exact continuation when the target is a replay or reconstruction.
