# Contextual Docs

Contextual is moving toward upstream tooling for agent sessions: inspect prior work, package reusable context, instantiate a new run in a target harness, and fork from known provenance. It does not try to promise exact control over a provider or harness buffer after a session is already in flight.

## Active Documents

| Document | Status | Purpose |
| --- | --- | --- |
| [ENG-contextual-platform.md](./ENG-contextual-platform.md) | active vision | Product and engineering architecture for Explore, Package, Instantiate, and Fork |
| [CONTRACT-session-package.md](./CONTRACT-session-package.md) | draft contract | Versioned package artifact with provenance, freshness, budgets, and compatibility |
| [CONTRACT-launch-and-fork.md](./CONTRACT-launch-and-fork.md) | draft contract | Launch recipes, instantiation records, fork plans, and replay semantics |
| [ENG-next-api-migration.md](./ENG-next-api-migration.md) | active plan | Route migration from the legacy Vite backend to the Next AppShell host |
| [HARNESS-CONTRACT.md](./HARNESS-CONTRACT.md) | active contract | Shared REST and TypeScript contract for harness catalog, at-rest, turns, and manifests |
| [ENG-harness-context-api.md](./ENG-harness-context-api.md) | active engineering note | Harness read-kernel design for native logs, turns, and turn-ready manifests |

## Decision Records

| Document | Status | Purpose |
| --- | --- | --- |
| [CTX-001-pi-ai-backend.md](./CTX-001-pi-ai-backend.md) | historical ADR | Why `pi-ai` exists as a stateless backend |
| [CTX-002-hudson-appshell-integration.md](./CTX-002-hudson-appshell-integration.md) | implementation ADR | Why Contextual is a standalone Hudson AppShell product |

## Source Of Truth

- `src/lib/harnessContract.ts`: public harness wire types and client helpers.
- `src/server/harnesses/*`: framework-neutral harness adapters and manifest builders.
- `src/lib/sessionAnalysis.ts`: Contextual interpretation layer: atoms, slices, blocks, and recipe drafts.
- `src/data/packages.ts`: prototype package seed data. The contract doc defines the target artifact shape.
- `src/contextualApp/*`: Hudson AppShell surfaces and navigation vocabulary.

## Current Runtime Shape

`bun dev` runs the Next AppShell host on port `5180`. `bun run dev:vite` remains as the legacy Vite prototype path.

Some live runtime routes are still Vite-era: `/api/dispatch`, `/api/branch`, `/api/workspace`, and OAuth helpers. The Next host already owns session analysis and harness read APIs. See [ENG-next-api-migration.md](./ENG-next-api-migration.md) before treating live dispatch as part of the new platform surface.
