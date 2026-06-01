# ENG-003: Context Sculpt And Boundary

Status: approved
Owner: Contextual
Last updated: 2026-05-31

## Summary

Contextual needs an explicit sculpt and boundary layer before cartridge parts are written.

The sculpt layer decides what source material is in scope, what is out of scope, how raw material is reduced, and which claims are safe to carry forward. The boundary layer prevents Contextual from implying it controls hidden provider state after launch.

## Problem

Context planning fails when the tool jumps directly from "lots of evidence exists" to "load this packet into an agent." Without a sculpt and boundary step, cartridges become transcript summaries with unclear omissions, weak provenance, and overstated continuity claims.

The product needs a durable answer to:

- Which repo, branch, docs, sessions, sidecars, and prior artifacts are in scope?
- Which source candidates were considered and rejected?
- Which facts are copied, compressed, transformed, inferred, or manually supplied?
- Which claims are outside Contextual's truth boundary?
- Which target harnesses can preserve native lineage, and which require replay or recipe-derived starts?

## Decision

Introduce `ContextSculpt` as the planning step that turns source candidates into cartridge-ready parts and boundary decisions.

This can begin as a TypeScript module and planner data shape before becoming a stored artifact.

## Goals

- Make inclusion and omission explicit.
- Protect the product boundary around opaque in-flight provider context.
- Preserve source-family and truth-label distinctions.
- Produce cartridge parts with known provenance and freshness.
- Give the planner a concrete stage between source discovery and cartridge compilation.

## Non-Goals

- Full semantic deduplication across every source type.
- Perfect tokenization.
- Provider-specific prompt reconstruction beyond logged evidence.
- Automatic source crawling beyond explicit scope.
- Runtime fork execution.

## Definitions

### Boundary

The boundary is what Contextual is allowed to claim.

Examples:

- "This cartridge includes the logged Codex decisions from session X."
- "This Claude branch is a replay fork, not a native continuation."
- "This OpenCode section is manual and incomplete."

Boundary violations include:

- "This exactly recreates hidden Claude memory."
- "This resumed the same session" when no native parent linkage exists.
- "This prompt is complete" when it was reconstructed from partial logs.

### Sculpt

The sculpt is the reduction process:

```txt
source candidates
  -> selected sources
  -> extracted claims
  -> omitted claims
  -> cartridge parts
  -> profile assignments
  -> validation warnings
```

It is not just summarization. It records decisions.

## Proposed Data Model

```ts
type SculptDecisionKind =
  | "include"
  | "omit"
  | "compress"
  | "transform"
  | "manual"
  | "block";

interface ContextSculpt {
  id: string;
  cartridgeId: string;
  scope: CartridgeScope;
  boundary: BoundaryRule[];
  candidates: SourceCandidate[];
  decisions: SculptDecision[];
  outputs: SculptOutput[];
}

interface BoundaryRule {
  id: string;
  claim: string;
  allowed: boolean;
  reason: string;
  appliesTo: LaunchTargetHarness[];
}

interface SourceCandidate {
  id: string;
  sourceId?: string;
  label: string;
  family: CartridgeSource["family"];
  estimatedSignal: "high" | "medium" | "low";
  truth: TruthState;
  risk: "low" | "medium" | "high";
}

interface SculptDecision {
  id: string;
  candidateId: string;
  kind: SculptDecisionKind;
  author: string;
  reason: string;
  createdAt: string;
  targetPartId?: string;
}

interface SculptOutput {
  partId: string;
  sourceIds: string[];
  transform: "copy" | "summary" | "extract" | "manual";
  tokenEstimate: number;
  warnings: string[];
}
```

The current `PlannerDecision` can carry some of this temporarily. The separate sculpt shape should appear when source selection becomes interactive.

## Boundary Rules

Boundary rules should be generated from:

- target harness capabilities
- source truth labels
- freshness state
- fork parent evidence
- selected launch profile

Initial rules:

| Rule | Decision |
| --- | --- |
| Hidden provider memory | Cannot be asserted unless provider exposes it as source |
| Native fork | Requires target-native parent-linked session |
| Replay fork | Allowed when manifest or cartridge parts reconstruct state |
| Manual fork | Allowed only with manual truth label and reason |
| Prompt completeness | Cannot be claimed for reconstructed prompt assembly |
| OpenCode deep pack | Block until source coverage is refreshed |

## Sculpt Pipeline

### 1. Discover candidates

Inputs:

- harness sessions from Explore
- turn-ready manifests
- docs
- sidecars
- existing cartridges
- manual notes

Output: `SourceCandidate[]`.

### 2. Score candidates

Score each source for:

- signal
- freshness
- truth strength
- target relevance
- duplication risk
- token cost

This score is advisory. The planner must record the final include/omit decision.

### 3. Apply boundary rules

Boundary rules can:

- add warnings
- force truth labels
- block specific target/profile combinations
- require manual reason fields
- prevent misleading lineage labels

### 4. Create sculpt decisions

Every selected source gets a decision. Every high-signal omitted source also gets a decision.

Reason: omissions are part of the context contract. A future agent needs to know whether something was forgotten, rejected, or deferred.

### 5. Emit cartridge parts

Sculpt outputs become `CartridgePart` drafts.

Each output must include:

- source ids
- transform type
- token estimate
- truth label
- freshness stability
- warnings

## UI Requirements

The sculpt UI belongs inside the planner's Sources and Review stages.

Minimum source-stage layout:

- candidate sources table
- selected sources table
- boundary warnings rail
- include / omit / defer affordances
- reason field for omit, manual, and override decisions

Minimum review-stage layout:

- list of included parts
- list of omitted/deferred candidates
- boundary violations
- publish blockers

## API Shape

Read routes:

```txt
GET /api/cartridges/:id/sculpt
GET /api/cartridges/:id/sculpt/candidates
```

Mutation routes:

```txt
POST /api/cartridges/:id/sculpt/candidates/refresh
POST /api/cartridges/:id/sculpt/decisions
POST /api/cartridges/:id/sculpt/compile
```

`compile` writes cartridge-part drafts but does not publish the cartridge.

## Validation

Validation should fail when:

- a required part has no sculpt output or provenance
- a high-risk candidate is included without a reason
- a high-signal candidate is omitted without a reason
- a boundary rule blocks the selected target/profile
- a lineage label contradicts target capability
- a manual transform lacks author and reason

## Implementation Plan

1. Add a local `contextSculpt.ts` type module.
2. Add boundary-rule helpers for lineage, hidden memory, prompt completeness, and source freshness.
3. Extend the seed cartridge planner data with sculpt decisions.
4. Render source candidates and boundary warnings in `/studio/cartridges/:id/planner`.
5. Add read-only derived sculpt data for the seed cartridge.
6. Add write routes after the planner mutation contract lands.

## Risks

- Sculpt can become too abstract. Keep it tied to candidate rows and cartridge parts.
- Boundary warnings can be ignored if they are only copy. Make them validation inputs.
- Agents can overcompress away useful provenance. Keep the source map visible before parts.
- Manual overrides can hide weak evidence. Require reason fields and lower health score.

## Acceptance Criteria

- Every cartridge part can be traced back to a sculpt output or manual decision.
- Every high-signal omission is recorded.
- Boundary rules prevent false native-fork and hidden-memory claims.
- Planner source stage can show selected, omitted, and blocked candidates.
- Health recommendations incorporate boundary warnings.
