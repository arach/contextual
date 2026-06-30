# Contextual

Upstream context tooling for agentic engineering. Contextual inspects prior sessions, packages durable context, instantiates new runs in target harnesses, and forks from known provenance.

Contextual is not trying to be the live control plane for hidden provider context. Model providers and harnesses increasingly own server-side caching, compression, memory, and session reconstruction. Contextual focuses on the durable boundaries before a run starts and when a run is deliberately forked, cloned, packaged, or replayed.

## Product model

| Verb | Primary surface | Product job |
| --- | --- | --- |
| **Explore** | Developer-first Studio | Inspect native sessions, turn-ready manifests, atoms, buckets, and stale context |
| **Package** | Developer-first Studio | Distill reusable context into versioned artifacts with provenance and freshness rules |
| **Instantiate** | Agent-first Runtime | Compile packages and recipes into a launch plan for a target harness/model/workspace |
| **Fork** | Agent-first Runtime | Derive a new run from a prior manifest or run with explicit lineage and transfer decisions |

See [docs/INDEX.md](docs/INDEX.md) for the active engineering docs.

## Quickstart

See it running in under a minute — no API keys, no local sessions required:

```bash
git clone https://github.com/arach/contextual && cd contextual
bun run setup              # clones the sibling workspace repos (hudson, studio) if missing
bun install
CONTEXTUAL_DEMO=1 bun dev  # → http://localhost:5180
```

First launch opens a short tour. **Demo mode** serves a curated, machine-independent
corpus, so Explore, Package, Instantiate, and Fork are all populated and clickable
immediately. When you're ready to use your own work, open the **Demo** chip in the top
bar → "Use my own sessions" (reads `~/.claude` and `~/.codex`), or just start with `bun
dev` and pick "Use my own sessions" on the welcome screen.

Env vars are documented in [`.env.example`](.env.example) — all optional; demo mode needs none.

## Backends

Contextual is vendor-neutral. Two backends ship today:

- **pi-coding-agent** — spawns the `pi` CLI (`@earendil-works/pi-coding-agent`) per dispatch. Native session tree, fork, and on-disk workspace materialization. Pick this when you want pi's rich session ergonomics.
- **pi-ai** — in-process via `@earendil-works/pi-ai`. Stateless; every call rebuilds the full Context from Contextual's Fixed/Soft state. Multiple providers (Anthropic, OpenAI, Google, Mistral, Bedrock). Pick this when you want pure context control.

Toggle per-thread via the backend chip in the top bar.

## Setup

Contextual is part of a small workspace: it consumes `hudsonkit` (UI chrome) from the
sibling `hudson` repo and shared primitives from the sibling `studio` repo. `bun run
setup` checks those out next to this repo (idempotent) so `bun install` can resolve the
workspace deps:

```bash
bun run setup   # clones ../hudson and ../studio if missing, builds hudsonkit
bun install
```

If you already have `../hudson` and `../studio` checked out, `bun run setup` is a no-op
and you can go straight to `bun install`.

For the fully offline **demo** path you can stop here — `CONTEXTUAL_DEMO=1 bun dev` needs
no backend. The sections below cover wiring a real backend for live dispatch.

For the **pi-coding-agent** backend, install pi globally:

```bash
npm install -g @earendil-works/pi-coding-agent
pi login   # OAuth or API key, your choice
```

For the **pi-ai** backend, you have two auth choices:

- **Recommended: Claude Pro/Max subscription** — click any Anthropic option in the backend chip; if not signed in, the OAuth flow opens automatically. Credentials persist to `~/.contextual/credentials.json` and refresh on demand.
- **API key** — set `ANTHROPIC_API_KEY` (or the equivalent for whichever provider you pick). Storage goes through the `secret` CLI so the value never lands in a `.env` file:

  ```bash
  secret set ANTHROPIC_API_KEY     # prompts for the value
  ```

  Then run the dev server with the credential injected into the child env:

  ```bash
  secret run ANTHROPIC_API_KEY -- bun dev
  ```

## Run

For the primary Next AppShell host:

```bash
bun dev                     # uses your real ~/.claude + ~/.codex sessions
CONTEXTUAL_DEMO=1 bun dev    # curated demo corpus, fully offline
```

Open `http://localhost:5180`. On first launch you'll get a one-time welcome tour; the
**Demo** chip in the top bar lets you switch between the demo corpus and your own
sessions at any time.

The legacy Vite prototype is still available for older live-dispatch paths:

```bash
bun run dev:vite
```

## Architecture

- `src/server/harnesses/*` - harness-neutral catalog, at-rest, turns, manifests
- `src/lib/harnessContract.ts` - shared REST contract and client helpers
- `src/server/session-analysis/*` - Contextual atoms, slices, buckets, and recipe drafts
- `src/contextualApp/*` - Hudson AppShell product surface
- `src/lib/backends/*` - legacy/live backend dispatch paths and pi integration

Contextual owns the upstream artifacts: packages, launch recipes, instantiation records, fork plans, and replay bundles. Harness-native sessions remain important, but they are treated as sources and targets rather than the whole product model.

Start with [docs/ENG-contextual-platform.md](docs/ENG-contextual-platform.md) for the current engineering vision.
