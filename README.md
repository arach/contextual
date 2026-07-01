# Contextual

Contextual is a context planning workbench for agentic engineering. It reads prior agent
sessions, turns them into inspectable context atoms, helps package durable context, and
prepares honest launch or fork plans for future runs.

It is deliberately upstream of the model provider's hidden context window. Providers and
harnesses own their own caching, compression, memory, and reconstruction. Contextual owns
the durable boundary: what was observed, what was selected, what was packaged, and what a
new run is allowed to claim as lineage.

## What You Can Do

| Surface | Job | Status |
| --- | --- | --- |
| Explore | Inspect native transcripts, turn-ready manifests, Contextual atoms, buckets, and stale context | primary app surface |
| Package | Distill reusable context into versioned artifacts with provenance and freshness rules | prototype-backed |
| Instantiate | Compile packages and recipes into a target-specific launch plan | in progress |
| Fork | Derive a new run from explicit prior state without pretending hidden state continued | in progress |
| Studio | Browse the engineering docs and interactive design prototypes behind those surfaces | active design lab |

The shortest version: Contextual answers "what should the next agent start with, and why
is that claim true?"

## Quickstart

You can run the full app with a bundled demo corpus and no API keys:

```bash
git clone https://github.com/arach/contextual
cd contextual
bun run setup
bun install
CONTEXTUAL_DEMO=1 bun dev
```

Open `http://localhost:5180`.

Demo mode is self-contained. It includes real captured sessions for comparison work, so
Explore, Package, Instantiate, Fork, and the guided walkthrough have useful data on first
load.

## Use Your Own Sessions

For local sessions, run:

```bash
bun dev
```

Contextual scans agent transcripts from `~/.claude` and `~/.codex`. If the catalog is
empty or you want one specific file, paste an absolute transcript path into the empty
Explore state and import it directly.

Useful session-analysis routes:

| Route | Purpose |
| --- | --- |
| `GET /api/session-analysis` | analyzed sessions |
| `GET /api/session-analysis?demo=1` | bundled demo corpus |
| `GET /api/session-analysis/catalog` | discovered local transcripts |
| `POST /api/session-analysis/pull` | analyze a specific transcript path |

## Studio

The Studio route is the project's design and architecture workspace:

```text
/studio
/studio/package-view
/studio/session-observe
/studio/replay
```

Highlights:

- `/studio` renders the CTX presentations and active engineering notes.
- `/studio/package-view` explores an IDE-like context package surface.
- `/studio/session-observe` shows one session as a turn-by-turn accumulation instrument.
- `/studio/replay` compares multiple harness lanes for the same scenario in lockstep.

Studio prototypes fetch real demo analysis from `/api/session-analysis?demo=1`; they are
views over existing data, not separate capture systems.

## Local Workspace

Contextual expects two sibling repositories:

- `../hudson`, for `hudsonkit` AppShell chrome and styling.
- `../studio`, for the shared Studio shell and document primitives.

`bun run setup` is idempotent. It clones or prepares those sibling workspaces when they
are missing, then ensures `hudsonkit` styles are available.

Common commands:

```bash
bun run setup        # prepare sibling workspace dependencies
bun install          # install packages
bun dev              # Next AppShell host on http://localhost:5180
CONTEXTUAL_DEMO=1 bun dev
bun run dev:vite     # legacy Vite prototype host
bun run typecheck
bun run build
```

Environment variables are documented in [`.env.example`](.env.example). Demo mode does
not require any of them.

## Backends

Contextual is vendor-neutral. Two live-dispatch backends exist today:

- `pi-coding-agent`: spawns the `pi` CLI per dispatch. Use it when you want pi's native
  session tree, fork support, and on-disk workspace materialization.
- `pi-ai`: runs in process through `@earendil-works/pi-ai`. Use it when you want each
  request rebuilt from Contextual's explicit Fixed and Soft state.

For `pi-coding-agent`:

```bash
npm install -g @earendil-works/pi-coding-agent
pi login
```

For `pi-ai`, either use provider OAuth where available or inject an API key through your
local secret manager, for example:

```bash
secret set ANTHROPIC_API_KEY
secret run ANTHROPIC_API_KEY -- bun dev
```

## Project Map

| Path | Purpose |
| --- | --- |
| `src/server/session-analysis/*` | transcript readers, atom extraction, bucket classification, recipe drafts |
| `src/server/harnesses/*` | harness-neutral catalog, at-rest records, turns, and manifests |
| `src/lib/harnessContract.ts` | shared REST and TypeScript contract for harness exploration |
| `src/components/analysis/*` | Explore workbench |
| `src/contextualApp/*` | Hudson AppShell integration and product state |
| `src/studio/*` | Studio docs, registry, and prototypes |
| `src/lib/backends/*` | live backend dispatch paths and pi integration |
| `docs/` | active engineering notes, contracts, and design specs |
| `context-data/` | reusable seed context and captured demo material |

## Design Principles

- Source truth first: native logs, manifests, docs, and sidecars remain the evidence.
- Interpretation second: atoms, buckets, slices, and packages are Contextual's model.
- Lineage must be explicit: native forks, replay forks, recipe-derived launches, and
  manual starts are different claims.
- Plans should be auditable before execution.
- If the product cannot prove a continuity claim, it should not imply one.

Start with [docs/INDEX.md](docs/INDEX.md) and
[docs/ENG-contextual-platform.md](docs/ENG-contextual-platform.md) for the current
engineering direction.
