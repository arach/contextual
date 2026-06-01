# CTX-001: Scope And Boundary

Status: active
Owner: Contextual
Last updated: 2026-05-31

## Thesis

Contextual is an agentic context planning tool. It plans the starting context before a session begins, and it records how that start was built.

The product should not claim control over hidden provider context once a run is in flight. Providers and harnesses increasingly own caching, compression, memory, summaries, and reconstruction. Contextual owns the durable boundary before launch, at explicit packaging time, and at truthful fork time.

## What Changes

The product moves away from "manage the current context window" and toward "design the next starting position."

That means Contextual should optimize for:

- clear scope
- explicit omissions
- source-backed claims
- reusable context packages
- target-specific load profiles
- health checks before launch
- honest lineage labels after fork

## Boundary Rules

| Claim | Allowed When |
| --- | --- |
| This source was included | Source ref exists and truth label is explicit |
| This prompt was reconstructed | Logged evidence supports a reconstruction, but prompt completeness is not asserted |
| This is a native fork | Target harness creates a parent-linked native session |
| This is a replay fork | Contextual compiles state from manifests, parts, and sidecars |
| This is a manual fork | A human supplied missing state and the reason is logged |
| Hidden memory is preserved | Only when the provider exposes it as source truth |

## Product Split

Explore and Package are developer-first. They are judgment surfaces.

Instantiate and Fork are agent-first. They are execution surfaces.

| Verb | Primary User | Product Job |
| --- | --- | --- |
| Explore | Developer | Inspect sessions, docs, manifests, and evidence |
| Package | Developer | Curate context into a reusable package |
| Instantiate | Agent | Compile a target launch plan |
| Fork | Agent | Continue from explicit lineage |

## Engineering Direction

The boundary should become a validation layer, not just copy. Any plan or fork record should be able to explain:

- what it claims
- what evidence supports the claim
- what is reconstructed or manual
- what is blocked
- what target compatibility limits apply

## Open Work

- Add boundary-rule helpers to the codebase.
- Show boundary warnings in the planner.
- Feed boundary warnings into health recommendations.
- Prevent native-fork labels without native parent evidence.
