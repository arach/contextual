# Turn-by-turn Replay — UI Presentation Spec (Hybrid)

## Purpose
Compare how N harness lanes of the **same scenario** accumulate context, in lockstep,
turn by turn. The corpus exists for this contrast (Hunt = 4 harness lanes; Relay =
3 harnesses × 2 stages), and clicking one session at a time hides it. Replay makes the
divergence legible — *same task, same green result, very different context strategies* —
which is the instructional payoff.

## Layout — two synchronized regions

### A. Overview swimlanes (top, ~40%)
- **One row per lane.** Lane = a session in the scenario. Hunt: codex / claude / pi / grok.
  Relay: per harness, **stage A → B concatenated** with a divider (so the handoff pickup — the
  instructional peak — is on screen).
- Each row renders its atoms **in turn order as segments, colored by bucket** (existing palette).
  v1: uniform width per atom. v2 toggle: width ∝ tokens (shows heft).
- A single **playhead** (vertical line) at the current turn spans all rows, aligned by `turnIndex`.
- **Past atoms (≤ playhead) render bright; future atoms dim** — accrual is visible as you scrub.
- Running token meter at each row's right edge (total ≤ playhead).
- Interaction: click / drag the playhead to scrub; hover an atom → tooltip (label · command · tokens · bucket).

### B. Detail strip (bottom, ~60%)
- **Columns, one per lane, aligned under the swimlanes.** At the current turn each column shows:
  - **This turn's action(s):** atom label(s) + bucket chip (e.g. `read HANDOFF · collaboration`).
  - **Running composition:** a stacked bar (reuse the Inspector's `StackedBar`) of cumulative bucket
    tokens ≤ playhead, plus the running token count.
  - A compact "⋯ prior N atoms" affordance to expand the accrued context.
- **Divergence cues:** when lanes' current buckets differ, badge them; show token Δ vs the leanest lane.

## Controls (top bar)
- Play / pause · step ◀ ▶ · scrub. Turn counter `turn t / T` (T = max turns across lanes).
- **Jump-to-moment markers** on the timeline, auto-derived from buckets: the handoff read
  (first `collaboration` atom), the first `verification` run, the first `codebase` edit.
- Scenario selector; for Relay, the A→B concatenation is default (toggle to a single stage).

## Data model (all present today — replay is a *view*, not a new capture)
- Sessions carry `atoms[]` with `turnIndex`, `bucket`, `tokens`, `label`, `command`. Group lanes by
  `SessionSource.scenario`. `GET /api/session-analysis?demo=1` already returns this.
- Per lane: `turns = groupBy(atoms, turnIndex)` (ordered); `composition(t) = cumulative bucket
  tokens for turnIndex ≤ t`. Turn axis normalized `0..maxTurn` across lanes; a lane past its end
  shows an end-cap ("done").

## Key decisions (v1)
- **Align by `turnIndex`** (semantic step number) — honest and simple. Milestone alignment later.
- **Uniform atom width** v1; token-proportional as a toggle.
- **Relay:** concatenate stage A → B per harness into one lane with a divider.
- **Entry + gating:** a "Replay scenario" action on a seed scenario; gated behind an
  `explore.replay` flag (default off), per basics-first.

## Milestone 1 (smallest shippable)
Static hybrid at a **draggable** (not yet auto-playing) playhead: swimlanes + detail strip +
running composition, **Hunt scenario (4 lanes)**, `turnIndex` alignment, uniform width. Everything
else — play/auto-advance, jump markers, Relay A→B concat, token-proportional width — layers on top.
