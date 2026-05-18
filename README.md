# Contextual

A deliberately *designed* context environment for agentic engineering. Decouples conversation threads from LLM context management: every dispatch is composed fresh from a Fixed zone (pinned-every-call modules) and a Soft zone (recent turns + summaries). Statelessness is a feature.

## Backends

Contextual is vendor-neutral. Two backends ship today:

- **pi-coding-agent** — spawns the `pi` CLI (`@earendil-works/pi-coding-agent`) per dispatch. Native session tree, fork, and on-disk workspace materialization. Pick this when you want pi's rich session ergonomics.
- **pi-ai** — in-process via `@earendil-works/pi-ai`. Stateless; every call rebuilds the full Context from Contextual's Fixed/Soft state. Multiple providers (Anthropic, OpenAI, Google, Mistral, Bedrock). Pick this when you want pure context control.

Toggle per-thread via the backend chip in the top bar.

## Setup

Install dependencies (bun is required):

```bash
bun install
```

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

For OAuth or pi-coding-agent (no API key needed):

```bash
bun dev
```

Open `http://localhost:5173`.

## Architecture

- `src/lib/backends/types.ts` — Backend interface, DispatchRequest, DispatchResult
- `src/lib/backends/pi-coding-agent.ts` — pi CLI backend (subprocess, native sessions)
- `src/lib/backends/pi-ai.ts` — pi-ai backend (in-process, stateless)
- `src/lib/backends/client.ts` — browser-side fetch client
- `vite-plugin-backends.ts` — dev-server router that dispatches to the right backend

Contextual owns the canonical branch/tree manifest. pi-coding-agent dispatches mirror to native pi sessions at `~/.contextual/sessions/`; pi-ai dispatches are stateless and have no on-disk footprint.

See `docs/CTX-001-pi-ai-backend.md` for the design rationale.
