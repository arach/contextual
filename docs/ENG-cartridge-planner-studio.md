# ENG: Cartridge Planner Studio

Status: active study
Owner: Contextual
Last updated: 2026-05-30

## Purpose

The `/studio` route is a Hudson-backed Studio app for the Contextual pivot from session explorer to cartridge planner.

It maps the concepts from the current product conversation into implementation proposals:

- context cartridges as the primary object
- collaborative planning instead of static package editing
- explorer as an evidence engine
- health diagnostics for efficiency, freshness, coverage, provenance, and evals
- launch profiles and honest fork lineage

## Route

```txt
GET /studio
GET /studio/cth-001
GET /studio/studies/planner-workbench
```

Implemented in:

```txt
app/studio/[[...slug]]/page.tsx
src/studio/ContextualStudioApp.tsx
src/studio/studioRegistry.ts
src/studio/StudioPages.tsx
```

This route is separate from the primary Contextual product route at `/`, but it now uses the shared `studio/app-shell` adapter so Hudson AppShell chrome, registry navigation, status pills, page strip, and route structure come from the shared Studio package.

## Proposal Map

The studio exposes five numbered CTH presentations:

| ID | Proposal | Implementation target |
| --- | --- | --- |
| `CTH-001` | North Star And Boundary | Define the upstream Contextual product boundary |
| `CTH-002` | Context Cartridge Artifact | Define `ContextCartridge`, load profiles, provenance, freshness, evals |
| `CTH-003` | Collaborative Context Planner | Replace static package editor with structured planning stages |
| `CTH-004` | Evidence And Health | Score efficiency, freshness, coverage, provenance, evals |
| `CTH-005` | Launch Profiles And Fork Trees | Compile cartridges into target-specific launch and fork plans |

## Design Studies

The route includes two embedded studies:

- **Planner Workbench**: intent, scope, targets, evals, and load profiles for a seed `agent-harness-context` cartridge.
- **Health Console**: metrics and rebuild recommendation for whether a starter context is worth loading.

These are not final UI components. They establish the product shape and the implementation vocabulary for the next slice.

## Next Slice

1. Promote the proposal data into a typed local module.
2. Define the cartridge schema in TypeScript.
3. Replace the current Package mode copy with cartridge/planner vocabulary.
4. Add a seed cartridge record for `agent-harness-context`.
5. Wire health diagnostics to real source freshness and token accounting.

## Design Constraints

- Keep the current `/` AppShell route stable.
- Do not rename persisted `session`, `designer`, or `analysis` mode IDs yet.
- Treat Explorer as a source/evidence layer, not the primary product destination.
- Treat `pi-ai` as a portable context handoff target and `pi-coding-agent` as the native tree/fork target.
