# CTX-004: Evidence And Health

Status: draft
Owner: Contextual
Last updated: 2026-05-31

Health answers one question: is this package worth launching? Explore is the surface where the health pass checks its claims against source evidence.

## Health inputs

| Metric | Meaning |
| --- | --- |
| Efficiency | Duplication, low-signal content, token cost |
| Freshness | Source age against policy and invalidation rules |
| Coverage | Required parts present for selected targets and profiles |
| Provenance | Parts backed by source refs and hashes |
| Evals | Truth and launch checks pass, warn, or fail |

## Recommendation output

The Health Console surfaces one recommendation per package:

| Recommendation | Meaning |
| --- | --- |
| Keep | Launch is safe |
| Refresh | Sources are stale but the structure is sound |
| Rebuild | Coverage or provenance needs structural work |
| Block Launch | Required truth or compatibility is missing |

The recommendation is the primary surface. Metric scores from the table above appear beneath it as supporting evidence.

## Warning drill-down

Every warning points at a specific source. The valid targets are:

- source row
- package part
- profile slot
- eval case
- boundary rule
- launch or fork preflight check

A warning with no concrete target is a bug in the health pass.

## Engineering direction

Health is computed from package data first: saved sources, parts, profiles, evals. Live source inspection runs only when a warning needs it.

The initial implementation scores the seed package. Later work attaches health calculations to actual source refs and adds deep links into the Explore surface.
