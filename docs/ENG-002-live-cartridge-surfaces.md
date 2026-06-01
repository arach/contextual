# ENG-002: Live Cartridge Studio Surfaces

Status: approved
Owner: Contextual
Last updated: 2026-05-30

## Decision

The `/studio` route should include product-flavored cartridge surfaces in addition to CTX markdown presentations and design-study fossils.

The first live routes are:

```txt
/studio/cartridges
/studio/cartridges/agent-harness-context
/studio/cartridges/agent-harness-context/planner
/studio/cartridges/agent-harness-context/health
/studio/cartridges/agent-harness-context/launch
/studio/cartridges/agent-harness-context/fork
```

## Why

CTX pages explain the vision. The product has to prove the vision with real tool surfaces:

- Cartridge Detail: what a future session will actually load
- Planner Workbench: how user-agent planning becomes structured decisions
- Health Console: whether the cartridge is worth launching
- Launch/Fork Preview: what the target agent receives and what lineage is being claimed

## Implementation

This proposal is implemented by:

- `src/studio/studioRegistry.ts`
- `src/studio/StudioPages.tsx`
- `src/studio/ContextualStudioApp.tsx`

The registry adds a `cartridges` bucket and `product` surface. The live pages render from `ContextCartridge` data instead of hard-coded illustrative arrays.

## Constraints

- Keep `/studio/studies/planner-workbench` and `/studio/studies/health-console` as design-study fossils for now.
- Keep Studio chrome from the shared `studio/app-shell` package.
- Use dense operational layouts, divider grids, status chips, and explicit truth labels.
- Never call a non-native replay a resumed or continued session.

## Acceptance

- Cartridge index, detail, planner, health, launch, and fork routes are registered.
- The Health Console produces one recommendation from typed data.
- Launch and fork previews render compiled plan records, including lineage labels.
- The implementation passes `bun run typecheck` and `bun run build`.
