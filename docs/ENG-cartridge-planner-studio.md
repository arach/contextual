# ENG: Cartridge Planner Studio

Status: active study
Owner: Contextual
Last updated: 2026-05-30

## Purpose

The `/studio` route is a Hudson-backed design and experimentation surface for
the Contextual pivot from session explorer to agentic context planning.

It maps the concepts from the current product conversation into proposal
material and prototype renderings:

- context cartridges as the primary object
- collaborative planning instead of static package editing
- explorer as an evidence engine
- health diagnostics for efficiency, freshness, coverage, provenance, and evals
- launch profiles and honest fork lineage

## Route

```txt
GET /studio
GET /studio/ctx-001
GET /studio/ctx-002
GET /studio/ctx-003
GET /studio/ctx-004
GET /studio/ctx-005
GET /studio/context-designer
GET /studio/context-designer/test-drive
GET /studio/cartridges
GET /studio/cartridges/agent-harness-context
GET /studio/cartridges/agent-harness-context/planner
GET /studio/cartridges/agent-harness-context/health
GET /studio/cartridges/agent-harness-context/launch
GET /studio/cartridges/agent-harness-context/fork
GET /studio/studies/planner-workbench
```

Implemented in:

```txt
app/studio/[[...slug]]/page.tsx
src/studio/ContextualStudioApp.tsx
src/studio/studioRegistry.ts
src/studio/StudioPages.tsx
```

This route is separate from the primary Contextual product route at `/`, which
owns real session creation and product state. Studio uses the shared
`studio/app-shell` adapter so Hudson AppShell chrome, registry navigation,
status pills, page strip, and route structure come from the shared Studio
package, but Studio remains the lab.

## Proposal Map

The studio exposes five numbered CTX markdown presentations:

| ID | Proposal | Implementation target |
| --- | --- | --- |
| `CTX-001` | Scope And Boundary | Define the Contextual product boundary |
| `CTX-002` | The Cartridge | Define `ContextCartridge`, load profiles, provenance, freshness, evals |
| `CTX-003` | The Planner | Replace static package editing with staged planning |
| `CTX-004` | Evidence And Health | Score efficiency, freshness, coverage, provenance, evals |
| `CTX-005` | Launch And Fork | Compile cartridges into target-specific launch and fork plans |

## Approved Engineering Proposals

| ID | Proposal | Implemented by |
| --- | --- | --- |
| `ENG-001` | Agentic Context Cartridge | `src/lib/contextCartridge.ts`, `src/data/contextCartridges.ts` |
| `ENG-002` | Live Cartridge Studio Surfaces | `/studio/cartridges/*`, `src/studio/StudioPages.tsx` |
| `ENG-003` | Context Sculpt And Boundary | source selection, omission, reduction, and truthful boundary rules |
| `ENG-004` | Collaborative Context Planner | staged proposals, decisions ledger, and compile-to-cartridge flow |

## Design Studies

The route includes two embedded studies:

- **Planner Workbench**: intent, scope, targets, evals, and load profiles for a seed `agent-harness-context` cartridge.
- **Health Console**: metrics and rebuild recommendation for whether a starter context is worth loading.

These are not final UI components. They establish the product shape and the
implementation vocabulary. When a flow graduates, its product behavior belongs
in the main app rather than in `/studio`.

## Next Slice

1. Keep Studio focused on proposal renderings and test-drive studies.
2. Move agent-assisted context creation into the main app designer flow.
3. Add `ContextSculpt` types and boundary-rule helpers from `ENG-003`.
4. Expand planner stages and decision persistence from `ENG-004`.
5. Move the seed cartridge from local data into an append-friendly store.
6. Add API routes for cartridge read, planner, sculpt, health, launch plan, and fork plan.
7. Compile `RecipeDraft` blocks into launch slots.
8. Add execution records after plan preview is stable.

## Design Constraints

- Keep the current `/` AppShell route stable.
- Do not rename persisted `session`, `designer`, or `analysis` mode IDs yet.
- Treat Explorer as a source/evidence layer, not the primary product destination.
- Treat Studio as the lab: no durable product state, no competing session creation flow.
- Treat `pi-ai` as a portable context handoff target and `pi-coding-agent` as the native tree/fork target.
