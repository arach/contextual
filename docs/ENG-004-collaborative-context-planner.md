# ENG-004: Collaborative Context Planner

Status: approved
Owner: Contextual
Last updated: 2026-05-31

## Summary

The Collaborative Context Planner is the user-agent workbench for creating and updating cartridges.

It replaces static package editing with staged planning. The planner turns a conversation about context into structured decisions, sculpt outputs, cartridge parts, load profiles, health checks, and launch/fork previews.

## Problem

Today, the most valuable planning work happens in chat. That makes it hard to reuse, inspect, validate, or fork. A future session has to rediscover the reasoning or rely on a lossy summary.

The planner should make the useful part of the conversation durable:

- what the user wanted
- which sources were considered
- which decisions were accepted, omitted, deferred, or edited
- which agent proposed each decision
- which cartridge parts were produced
- which launch profiles and evals were selected

## Decision

Build the planner as a staged workbench at:

```txt
/studio/cartridges/:id/planner
```

The planner is not a chat UI. It can use agents, but agents produce proposals and decision records, not unstructured transcript blobs.

## Goals

- Make user-agent planning legible and auditable.
- Capture decisions as structured data.
- Let agents propose and developers approve.
- Feed cartridge generation, health checks, and launch/fork previews.
- Keep omitted and deferred decisions visible.
- Support named agent authors such as `@codex` and `@claude`.

## Non-Goals

- Full collaborative text editor.
- General-purpose chat surface.
- Real-time multi-user synchronization in the first slice.
- Automatic execution of launch/fork plans.
- Full source discovery automation before ENG-003 lands.

## Stage Model

Initial planner stages:

| Stage | Purpose | Output |
| --- | --- | --- |
| Intent | Define the future session job | intent, objectives |
| Scope | Set workspace and boundary | `CartridgeScope`, boundary hints |
| Sources | Select and omit evidence | source map, sculpt decisions |
| Targets | Choose harnesses and compatibility | `LaunchTarget[]` |
| Profiles | Define briefing, working-set, deep-pack | `LoadProfile[]` |
| Evals | Select truth and launch tests | `EvalCase[]` |
| Refresh | Define freshness policy | `FreshnessPolicy` |
| Review | Compile and validate | cartridge draft or version |

The current seed implements a subset in `PlannerStage[]`. The full stage set should be added before mutation APIs are exposed.

## Data Model

The current lightweight shape:

```ts
interface PlannerStage {
  id: string;
  label: string;
  title: string;
  status: PlannerStageStatus;
  charter: string;
  proposal: PlannerProposal;
  decisions: PlannerDecision[];
}

interface PlannerDecision {
  id: string;
  kind: "accept" | "omit" | "defer" | "edit";
  stageId: string;
  author: string;
  reason: string;
  createdAt: string;
}
```

The durable planner should split stage state from decision history:

```ts
interface PlannerRun {
  id: string;
  cartridgeId: string;
  status: "drafting" | "reviewing" | "compiled" | "abandoned";
  activeStageId: string;
  stages: PlannerStageState[];
  decisions: PlannerDecision[];
  proposals: PlannerProposal[];
  compiledVersion?: string;
}

interface PlannerStageState {
  id: PlannerStageId;
  status: PlannerStageStatus;
  acceptedValue?: unknown;
  notes?: string;
  blockers: string[];
}

interface PlannerProposal {
  id: string;
  stageId: PlannerStageId;
  author: string;
  version: number;
  createdAt: string;
  summary: string;
  payload: unknown;
}
```

`payload` should become stage-specific once the schema stabilizes.

## Interaction Model

Each stage has four zones:

1. Stage header: name, charter, state, blockers.
2. Proposal zone: agent-authored or developer-authored proposal.
3. Decision controls: accept, omit, edit, defer.
4. Notes: developer-authored reason or additional constraints.

Decision rules:

- Accept freezes the current proposal into `acceptedValue`.
- Omit records that the candidate or stage output was considered and rejected.
- Edit creates a developer proposal version before acceptance.
- Defer keeps the stage incomplete and adds a review blocker when required.

The right rail is a decisions ledger. It must always show accepted, omitted, deferred, and edited decisions.

## Agent Behavior

Agents should not write directly to published cartridge state.

Allowed agent actions:

- propose stage values
- refresh source candidates
- summarize source evidence
- identify boundary warnings
- recommend evals
- compile draft parts
- explain health failures

Developer authority:

- accept proposal
- publish cartridge
- override health recommendation
- acknowledge stale launch
- approve manual truth labels

## Planner To Cartridge Compile

The planner compiles accepted stage values into a cartridge draft:

```txt
PlannerRun
  -> accepted intent/scope/sources/targets/profiles/evals/refresh
  -> sculpt decisions
  -> cartridge parts
  -> validation result
  -> draft cartridge version
```

Compile should be deterministic from accepted values and source refs. Agent prose should not be the only source of truth.

## API Shape

Read routes:

```txt
GET /api/cartridges/:id/planner
GET /api/cartridges/:id/planner/stages/:stageId
```

Mutation routes:

```txt
POST /api/cartridges/:id/planner/proposals
POST /api/cartridges/:id/planner/decisions
POST /api/cartridges/:id/planner/compile
POST /api/cartridges/:id/planner/abandon
```

`compile` writes a draft cartridge version. It does not publish.

## UI Requirements

The planner route should use a three-column layout:

```txt
stage nav | active stage workspace | decisions ledger
```

Desktop requirements:

- stage nav with status dot per stage
- center stage workspace
- right decisions ledger
- visible cartridge lifecycle and version
- no marketing hero
- no unstructured chat feed as the primary object

Mobile requirements:

- stage nav collapses above stage workspace
- decisions ledger becomes a tab or drawer
- decision controls remain visible below proposal

## Validation

Planner compile should fail when:

- required stages are not accepted
- accepted source stage has no selected source
- accepted profile references missing parts
- accepted target has unsupported compatibility without a transform plan
- eval stage is empty for `review` or `published`
- boundary rule from ENG-003 is unresolved

Planner compile may warn when:

- source freshness is stale but override reason exists
- manual truth labels exist
- target is transform-required
- deep-pack profile exceeds preferred budget but not max budget

## Implementation Plan

1. Keep current read-only planner route backed by `ContextCartridge.planner`.
2. Add all planned stage ids to the seed data.
3. Extract planner UI primitives: `StageNav`, `StageWorkspace`, `DecisionLedger`, `DecisionRow`.
4. Add `PlannerRun` and stage-specific value types.
5. Add read API for planner state.
6. Add proposal/decision mutation API.
7. Add deterministic compile from accepted values to cartridge draft.
8. Gate publish on cartridge validation and eval state.

## Risks

- The planner can accidentally become chat again. Keep the primary objects proposals and decisions.
- Agent proposals can feel opaque. Every proposal needs source refs or boundary notes.
- Decision history can get noisy. Keep the ledger compact and filterable.
- Compile can become non-deterministic if it reads live session state implicitly. Compile only from accepted values and source refs.

## Acceptance Criteria

- Planner route shows stage nav, proposal workspace, and decision ledger from typed data.
- Accepted, omitted, deferred, and edited decisions are persisted separately from proposal text.
- Compile can produce a draft cartridge version without using transcript state.
- Publish is blocked until required stages, validation, and selected evals pass.
- Agent-authored proposals are visibly attributed and reviewable before they affect cartridge state.
