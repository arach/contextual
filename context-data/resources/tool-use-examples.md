# Tool Use Examples

Status: review
Truth: manual
Last reviewed: 2026-06-01

## Purpose

Useful context cartridges should include the verification habits expected of the
target agent. This file collects local examples that can be summarized into a
test-drive brief.

## Examples

| Situation | Expected Tool Habit |
| --- | --- |
| UI route changed | Run typecheck/build, open the local route, inspect rendered state, and check browser console errors |
| Studio markdown changed | Verify the markdown source, route registry, rendered article, and source rail all agree |
| Agent delegation used | Preserve who produced the output, what direction they received, and whether it is accepted evidence or design input |
| Context launch planned | Produce a plan record with target, profile, prompt parts, sidecars, checks, and lineage label |

## Test-Drive Prompts

- Ask the fresh agent to explain the product boundary.
- Ask the fresh agent to create a Claude launch plan and inspect whether it overclaims native continuity.
- Ask the fresh agent for OpenCode details and inspect whether it flags missing source coverage.
