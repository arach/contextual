# ENG: Next API Migration

Status: active plan
Owner: Contextual
Last updated: 2026-05-30

## Problem

`bun dev` now runs the Next AppShell host on port `5180`, but some live runtime behavior still depends on legacy Vite routes. This creates a product ambiguity: the primary host is Next, while dispatch and branch behavior still live in the old prototype path.

The new platform direction should not preserve those routes as generic live-chat primitives. It should migrate only the pieces that support Instantiate and Fork.

## Current Route Map

| Route | Current owner | Status |
| --- | --- | --- |
| `GET /api/session-analysis` | Next | active |
| `GET /api/session-analysis/bootstrap` | Next | active |
| `GET /api/session-analysis/catalog` | Next | active |
| `POST /api/session-analysis/pull` | Next | active |
| `GET /api/harnesses/catalog` | Next | active |
| `GET /api/harnesses/sessions/:sessionKey/*` | Next | partially active |
| `GET /api/tree` | Next | active |
| `POST /api/dispatch` | Vite legacy | migrate or retire |
| `POST /api/branch` | Vite legacy | migrate as fork planning/execution |
| `GET /api/workspace` | Vite legacy | migrate as launch materialization metadata |
| OAuth helpers | Vite legacy / backend code | migrate behind target harness auth |

## Target Route Map

| Route | Purpose |
| --- | --- |
| `POST /api/launch/plan` | Compile packages and recipes for a target harness without side effects |
| `POST /api/launch/instantiate` | Create a native session/workspace from a launch plan |
| `POST /api/forks/plan` | Build transfer decisions from a parent manifest/run to a target launch |
| `POST /api/forks/execute` | Execute a reviewed fork plan |
| `POST /api/manifests/diff` | Compare source and target manifest/replay shapes |
| `GET /api/packages` | List persisted packages |
| `GET /api/packages/:id` | Read one package version |
| `PUT /api/packages/:id` | Save a draft package |

## Migration Order

1. Keep existing session analysis and harness routes as the read foundation.
2. Extract any reusable materialization code from `src/lib/backends/pi-coding-agent.ts` into a server-side launch module.
3. Add package persistence and validation behind route handlers.
4. Add plan-only launch and fork routes.
5. Update the Runtime UI so "Instantiate" calls plan routes first.
6. Add execution routes after plans are auditable.
7. Retire generic `/api/dispatch` and `/api/branch` from the primary Next path.

## Behavior During Migration

- Explore remains the default and reliable surface.
- Package can stay prototype-backed while the contract lands.
- Instantiate may show warnings until Next execution routes exist.
- Legacy Vite can remain available through `bun run dev:vite`, but docs and product copy should not describe it as the primary path.

## Implementation Notes

- Route handlers should stay thin and delegate to `src/server/*` modules.
- Server modules should be framework-neutral enough to test without Next.
- Auth and credential resolution belong near target harness adapters, not UI code.
- Plan routes should never mutate native sessions.
- Execution routes should always write an instantiation or fork record, even on partial failure.
