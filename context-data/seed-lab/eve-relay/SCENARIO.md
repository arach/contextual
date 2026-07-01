# Seed scenario — Eve ellipse binding ("Relay" posture)

Reproducible sandbox for a **two-stage relay** capture: one agent investigates
and writes a handoff; a second agent resumes from that handoff and implements.
This is the shape a single bug-fix can't exercise — the durable residue is a
**handoff artifact**, and stage B *opens on that handoff as input context*
(the atom that should classify into collaboration/handoff).

- **Relay posture:** context is built to be picked up by someone else. Heavy on
  decisions/handoff/history; the keep is a written plan, not a one-line diff.
- **Feature:** Eve binds arrows to rectangles but not ellipses. `npm test` is
  green on the rectangle cases and **red on the four ellipse cases** at baseline.
- **The math** (already noted in `geometry.mjs`): for center `c`, radii
  `(rx, ry)` and ray `d = from - c`, the boundary point is
  `c + d * s` where `s = 1 / sqrt((d.x/rx)^2 + (d.y/ry)^2)`. For a circle this
  reduces to `c + normalize(d) * r`.

## Relay protocol (identical sandbox baseline before each stage)

**Stage A — investigate + hand off (no code).**
> Eve's canvas can bind arrows to rectangles but not ellipses — `npm test` is red
> on the ellipse cases. Do NOT implement the fix. Investigate how rectangle
> binding works across `geometry.mjs`, `shapes.mjs`, and `binding.mjs`, then write
> `HANDOFF.md` for the next engineer: the approach for ellipse binding geometry,
> exactly which files/functions to change, the expected math, edge cases, and
> what you verified. Leave the code unchanged.

**Stage B — resume + implement.**
> Read `HANDOFF.md`. Implement ellipse binding per the plan so `npm test` passes.
> Keep geometry pure and do not modify the test files. In your final message,
> note anything where you deviated from the handoff.

Captured for codex first; claude/pi/grok lanes optional. Ingested under
`seed-sessions/eve-relay/` with scenario `eve-relay`, posture Relay, as a linked
two-session pair (stage-a / stage-b).
