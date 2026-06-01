# CTX-005: Launch And Fork

Status: active
Owner: Contextual
Last updated: 2026-05-31

## Thesis

Instantiate and Fork compile context packages into target-specific plans with honest lineage labels.

The value is not perfect hidden-state cloning. The value is auditable continuity from a known artifact.

## Launch

A launch plan selects:

- target harness
- model or provider
- workspace
- load profile
- prompt parts
- sidecars
- preflight checks
- plan record

The plan can be saved before it executes. Agents should be able to read the plan record directly.

## Fork

A fork plan adds lineage and transfer decisions.

| Lineage | Meaning |
| --- | --- |
| Native Fork | Target harness creates a parent-linked native session |
| Replay Fork | New run starts from a replay bundle compiled from evidence |
| Recipe-Derived | Prior state becomes a launch recipe |
| Manual Fork | Human supplied missing state |

Never call a replay fork "continued" or "resumed." That implies hidden-state identity Contextual does not guarantee.

## Transfer Decisions

Fork preview should show what happens to each parent part:

| Action | Meaning |
| --- | --- |
| Direct | Carry forward unchanged |
| Transform | Convert for target harness or profile |
| Harness-native | Pass through native workspace/session affordance |
| Drop | Do not carry forward |
| Manual | Human supplies the missing state |

Drop and manual decisions require reasons.

## Engineering Direction

Launch and fork routes should remain previews until plan records are stable. Execution should come after:

- package validation
- health recommendation
- target compatibility
- preflight checks
- plan persistence
