# CTX-003: The Planner

Status: active
Owner: Contextual
Last updated: 2026-05-31

## Thesis

The planner is where user-agent context design happens.

It should not be another chat surface. Agents can help, but the durable output should be proposals, decisions, source selections, sculpt outputs, and package drafts.

## Why Planning Needs Structure

The valuable reasoning usually happens in conversation:

- what the user wants
- which sources matter
- which sources should be ignored
- which targets need support
- which claims are risky
- which profile should launch

If that stays in chat, the next session has to rediscover it. The planner turns that reasoning into structured state.

## Stages

| Stage | Output |
| --- | --- |
| Intent | Intent and objectives |
| Scope | Workspace boundary and branch hints |
| Sources | Selected sources, omitted sources, source truth labels |
| Targets | Harness compatibility and transform requirements |
| Profiles | Briefing, working-set, and deep-pack definitions |
| Evals | Truth and launch test suite |
| Refresh | Freshness policy and invalidation rules |
| Review | Compiled package draft |

## Interaction Model

Each stage has four zones:

1. Stage charter
2. Proposal
3. Decision controls
4. Notes and blockers

Agents write proposals. Developers accept, omit, edit, or defer.

The right rail is a decisions ledger. It should keep accepted, omitted, deferred, and edited choices visible.

## No Chat As The Primary Object

The planner can use a model, but the model should emit proposals and source-backed recommendations.

The UI should avoid a long transcript as the main artifact. A transcript drawer can exist later, but the primary durable records are:

- `PlannerProposal`
- `PlannerDecision`
- `ContextSculpt`
- `ContextCartridge`
- `CartridgePlan`

## Compile Flow

```txt
PlannerRun
  -> accepted stage values
  -> sculpt decisions
  -> package parts
  -> validation result
  -> draft package version
```

Compile must be deterministic from accepted values and source refs. Agent prose should not be the only source of truth.

## Open Work

- Add the full stage set to the seed package.
- Split planner stage state from decision history.
- Add read APIs for planner state.
- Add proposal and decision mutation APIs.
- Compile accepted planner state into a draft package version.
