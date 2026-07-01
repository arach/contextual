# Single-Session Context Instrument — "Context Filling" (Studio Spec)

## Purpose (the FIRST layer)
Clarity on **one session as it progresses**. For a single run, answer:
- **What is the context?** (composition)
- **How does the conversation fill it, and at what pace?** (accrual + velocity)
- **What's noise? What's signal?** (quality of each contribution)

Harness-to-harness comparison (the 4-lane replay) and cache / cache-hit viz are
*later* layers. This is the foundation.

## Data (real, present today)
- One session from `GET /api/session-analysis?demo=1`. Default to a codex lane
  (`id` = `eve-relay--codex-gpt-5-5--implement`, ~23.6k, rich buckets incl.
  collaboration/verification) with a **session picker** across the real corpus.
- `atoms[]` carry `turnIndex`, `bucket`, `tokens`, `label`, `command`,
  `sourceType`, `artifactType`, `lifecycle`, `stability?`, `pinned?`, `role`,
  `toolName`.
- Derive per turn: atoms grouped by `turnIndex`; cumulative composition by bucket
  ≤ t; per-turn token delta.

## Layout
### Header
Session title · harness · model · total tokens · turn count · **% noise**.

### Main — "Context filling" (accrual over turns)
- **Stacked AREA chart**: X = `turnIndex` (0..maxTurn), Y = cumulative context
  tokens, stacked by bucket (existing palette). The window filling up.
- A draggable **playhead** (turn). Region ≤ playhead solid/bright; future faint.
- A **pace track** below: per-turn token-delta bars (how much each turn added).
  Tall bar = a dump. This is "at what pace."

### Signal / Noise
- Each atom flagged **noise** vs **signal** (heuristic below). In the area chart
  and pace track, noise renders dim/hatched, signal solid. Header shows **% noise**.

### Detail (at playhead)
- **This turn:** the atom(s) added — label, bucket chip, `+tokens`, and a
  **NOISE / SIGNAL** tag with the reason.
- **Window now:** running composition stacked bar (cumulative bucket tokens ≤
  playhead) + total.

### Controls
Play / pause · step ◀▶ · scrub · turn counter `t / T` · space/arrow keys.

## Noise vs signal heuristic (v1 — the meaty, tweakable part)
From available atom fields:
- **NOISE:** a tool *output* (not a message/reasoning) AND bucket ∈ {tools,
  codebase, environment} AND large (top-quartile tokens) AND not pinned AND
  (low `stability` / ephemeral `lifecycle` if present). A big one-shot read/dump.
- **SIGNAL:** bucket ∈ {decisions, task, policy} OR `pinned` OR `artifactType` ∈
  {decision, handoff} OR durable `stability`. The load-bearing spine.
- **NEUTRAL:** everything else.
Compute per-atom + a session **% noise** (noise tokens / total). Surface which
fields drove each call, and REPORT what's missing (e.g. true reference/reuse
counts) — sharpening this is where the real insight lives, and where cache-hit
viz plugs in later.

## Milestone 1
Static draggable playhead, one codex session: accrual area + pace track +
noise/signal shading + detail. Play/auto-advance and the session picker layer on.
