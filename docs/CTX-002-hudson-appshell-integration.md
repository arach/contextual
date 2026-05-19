# CTX-002 — Hudson AppShell integration (standalone Contextual product)

**Status:** Draft v3 — upstream AI contract + @contextual-codex review
**Owner:** @arach
**Date:** 2026-05-18

## For Hudson review

**Read first:** [Hudson upstream requirements](#hudson-upstream-requirements-contextual--hud-006) · [AI chat surface](#ai-chat-surface--appshell-vs-workspaceshell-vs-contextualchat) · [AI stance](#ai-stance-decided)

**Related Hudson spec:** `~/dev/hudson/specs/hud-006-ai-backends.md` (AppShell integration §)

**Ask:** Align proposed AppShell AI resolution order + `useAIContext` / `useAppAI()` with HUD-006. Contextual dogfoods whatever lands. Smallest hudsonkit PR to unblock Contextual Phase 2?

**Open design questions:**

1. `slots.Chat` vs `app.ai` — override or compose?
2. What's landed in hudsonkit vs still draft for HUD-006 AppShell path?
3. Pushback on resolution order (Chat → ai → legacy Assistant → none)?

**Codex review:** [Review log](#review-log) · full thread via Scout `flt-mpbxgbjg-xl0p8q`

## TL;DR

Retire Contextual as a standalone Vite SPA with bespoke chrome and a custom ask endpoint. Rebuild it as a **single-app Hudson consumer**: a Next.js app that mounts `<AppShell app={contextualApp} assistant={false} />`, owns its own `/api/ai/chat` + session-analysis routes, and focuses engineering on **transcript semantics** and a **domain-specific `contextual` toolset**.

This is **not** registration inside the default Hudson OS build (`registry.ts`). Contextual stays its own repo and deployable; it borrows HudsonKit componentry and HUD AI patterns turnkey.

**Wording:** say **one lab, one AppShell product** — not "one workspace." WorkspaceShell is Hudson OS multi-app mode; we are not using it.

## Problem

Contextual today duplicates Hudson concerns:

- Custom `Frame`, panel resize, mode switch, command palette wiring (`App.tsx`)
- Vite plugin pretending to be a server (`vite-plugin-backends.ts`)
- Custom context console + `/api/session-analysis/ask` (parallel to Hudson `/api/ai/chat`)
- HudsonKit consumed via symlink + style ensure hack

We get chrome parity but not AI parity, and every Hudson improvement (Assistant, relay, toolsets, theming) must be reimplemented or manually ported.

## Goal

**One lab, one AppShell product, one `HudsonApp`.** Contextual as a Hudson-shaped product:

| Borrow from Hudson | Build in Contextual |
| --- | --- |
| `AppShell` (nav, panels, status, command palette, terminal drawer) | Session catalog + Explore workbench |
| `useHudsonAI`, `<AI />` | Verbatim atom layer + window/allocation model |
| `/api/ai/chat` contract + toolset registration | Transcript parsing + heuristic classifier |
| Intents for shell/navigation actions | **`contextual` toolset** — domain tools, not generic chat |
| Theming, persistence patterns | "Contextual model" labeling (buckets are ours, not provider ground truth) |

## Non-goals

- Registering Contextual in `hudson/app/apps/registry.ts` or default Hudson workspaces
- Forking the Hudson monorepo
- Multi-app `WorkspaceShell` / canvas mode (can revisit later)
- Porting Work (threads/rack/composer) or Packages (designer) in phase 1 — **Explore is primary**
- Full Shiki/CodeMirror syntax highlighting (deferred)
- Relay / PTY terminal as a v1 requirement (optional later)

## Architecture

### Shell: AppShell, not WorkspaceShell

```
contextual/                         ← own repo, own deploy
  app/
    page.tsx                        → <AppShell app={contextualApp} assistant={false} />
    globals.css                     → @import hudsonkit/styles
    api/
      ai/chat/route.ts              → same contract as Hudson (Node runtime)
      ai/toolsets/contextual.ts     → domain toolset
      session-analysis/...          → migrated from vite-plugin-backends
  src/
    contextualApp/
      index.ts                      → HudsonApp export
      ContextualProvider.tsx
      slots/                        → Content, LeftPanel, Inspector, ContextualChat
      hooks/                        → useCommands, useStatus, useContextualExploreAI
      intents.ts
    lib/                            → sessionAnalysis, contextTree, sessionExplore (existing)
    server/                         → framework-neutral modules extracted from vite plugin
```

Reference: Hudson docs `building-apps.md` ("Outside Hudson via AppShell"), `quickstart.md`, Premotion case study.

### AI stance (decided)

We are **authors of Hudson**. Gaps discovered while building Contextual are **upstream requirements**, not permanent workarounds. Contextual is the dogfood app that proves the contract.

**Target (turnkey):** one declarative field on `HudsonApp` + AppShell wiring — see **Hudson upstream requirements** below. Roughly:

```ts
ai: hudAI({ surface: 'chat', toolset: 'contextual', placement: 'drawer' }),
slots: { Chat: ContextualChat, ... },
hooks: { useAIContext: () => ({ session, selection, window, ... }), ... },
```

**Interim (until hudsonkit lands):** mount `ContextualChat` ourselves with `assistant={false}`. Same components (`useHudsonAI`, `<AI />`), manual placement. Delete interim path once AppShell consumes `app.ai` + `slots.Chat`.

See **AI chat surface** for today's AppShell vs WorkspaceShell split.

### AI flow

```
Explore UI state (Provider)
        ↓
useContextualExploreAI({
  toolset: 'contextual',
  context: { sessionId, selection, windowMode, bucketSummaries, ... },
  onToolCall: applyExploreMutations,
})
        ↓
POST /api/ai/chat
        ↓
contextual toolset (system + context renderer + Zod tools)
        ↓
tool_call events → onToolCall → tree, selection, window, inspector
```

**Context policy:** do not dump all verbatim atom bodies into chat context every turn. Send structured summaries + ids; use `quote_verbatim` tool when the model needs exact text.

**Retire:** `ContextConsolePanel`, `/api/session-analysis/ask`, bespoke `answerWithModel` one-shot path.

### AI chat surface — AppShell vs WorkspaceShell vs ContextualChat

Hudson has **three** AI-related concepts. Only two matter for us:

| Surface | Where it lives | What it does | Contextual uses it? |
| --- | --- | --- | --- |
| **Generic Assistant** | AppShell bottom drawer | Relay (PTY) + chat via **`intents` toolset** — dispatches app commands | **No** — wrong toolset, no session context, defaults to relay |
| **`slots.Chat`** | WorkspaceShell bottom drawer | App-designed chat (`DayStackChat`, `LogoChat`) wired when focused app provides the slot | **Not auto-wired in AppShell** — see below |
| **Custom chat component** | Anywhere we mount it | `useHudsonAI({ toolset: 'contextual' })` + `<AI />` | **Yes — `ContextualChat`** |

#### What "AppShell ignores `slots.Chat`" means

`HudsonApp.slots.Chat` is a real slot on the type. In **WorkspaceShell** (Hudson OS), when an app defines `Chat`, the shell renders it in the bottom console and toggles between "Hudson AI" and "App AI."

In **AppShell** (single-app shell), the bottom drawer only knows two tabs:

1. **Terminal** — if `slots.Terminal` exists
2. **Assistant** — generic `<Assistant app={app} commands={appCommands} />` (always `intents` toolset)

AppShell **never reads `slots.Chat`**. If we define `DayStackChat`-style `slots.Chat` on `contextualApp` and mount AppShell, nothing happens — the slot is dead code unless we render it ourselves.

This is not a Hudson bug; it's a scope split. AppShell predates / doesn't include the WorkspaceShell app-AI console wiring.

#### Our placement options for ContextualChat

1. **Inspector (right panel)** — v1 default. Explore already has allocation/metadata there; chat sits alongside or in a tab. No shell changes.
2. **Custom bottom drawer** — thin wrapper around `TerminalDrawer` + `ContextualChat`; page owns open/close state. Matches "drawer chat" UX without patching hudsonkit.
3. **Upstream hudsonkit patch** — teach AppShell to prefer `slots.Chat` over generic Assistant when present. Nice later; not a blocker.

**Interim decision:** Inspector or custom drawer until upstream lands. **`assistant={false}`** on AppShell today.

**Target decision:** AppShell mounts `slots.Chat` in the drawer when present; `app.ai` supplies toolset/backend/placement. No manual drawer wrapper in Contextual.

### Hudson upstream requirements (Contextual → HUD-006)

Contextual exposes what AppShell needs to make app AI turnkey for **standalone consumers** (not only WorkspaceShell).

#### Problem today

| Shell | AI wiring | Gap |
| --- | --- | --- |
| **AppShell** | Hardcoded generic `<Assistant />` (`intents` + relay default) | Ignores `slots.Chat` and `app.ai`; no context hook |
| **WorkspaceShell** | `slots.Chat` + workspace AI toggle | Multi-app only; not our product shape |

Standalone apps (Contextual, Hero, Premotion) get the wrong default and must hand-roll placement.

#### Proposed AppShell resolution order

When the bottom drawer opens its AI tab, AppShell resolves in order:

1. **`slots.Chat`** — app-designed surface (ContextualChat, DayStackChat). Shell provides drawer chrome + toggle; app owns composer skin and reads shared AI hook.
2. **`app.ai`** (HUD-006 `hudAI()` config) — shell mounts default chat/terminal surface wired to toolset + backend. No custom slot required for simple apps.
3. **Legacy `<Assistant />`** — only if no `app.ai` and `app.intents` non-empty. Deprecate; opt-in via `assistant={true}` during migration.
4. **No AI tab** — if none of the above.

This unifies WorkspaceShell's `slots.Chat` idea with AppShell's drawer without requiring WorkspaceShell.

#### Proposed `HudsonApp` additions

```ts
interface HudsonApp {
  // HUD-006 — declarative AI config
  ai?: HudsonAppAIConfig;  // hudAI({ surface, toolset, placement, backend, ... })

  hooks: {
    // ...existing
    /** Live snapshot merged into every AI request context. */
    useAIContext?: () => Record<string, unknown>;
  };

  slots: {
    // ...existing
    /** Optional custom chat skin. When set, AppShell drawer renders this instead of generic AI chrome. */
    Chat?: React.FC;
  };
}
```

Shell exposes **`useAppAI()`** inside Provider so `slots.Chat` components don't re-wire transport:

```ts
// Inside ContextualChat — no manual useHudsonAI setup once upstream lands
const chat = useAppAI();  // toolset, context merge, onToolCall routing from app.ai config
return <AI chat={chat} placeholder="Ask about this session..." />;
```

#### What Contextual needs specifically

- **`toolset: 'contextual'`** — domain tools, not `intents`
- **`useAIContext`** — session id, selection, window mode, bucket summaries (not full verbatim dump)
- **`slots.Chat`** — Explore-branded header, activity line, attachment toggles for atoms/buckets
- **`placement: 'drawer'`** — Cmd+J toggle, same as Hudson OS apps
- **No relay default** — chat surface only for v1; terminal/relay opt-in later
- **Async credentials** — credential resolver accepts Promise (Contextual OAuth path)

#### Delivery split

| Where | What |
| --- | --- |
| **hudsonkit** | AppShell resolution order, `HudsonApp.ai`, `useAppAI()`, `useAIContext` merge, deprecate implicit Assistant |
| **@hudsonkit/ai** | Portable toolset registry, NextRouteAdapter, async credential resolver |
| **contextual** | `contextual` toolset, `ContextualChat`, `useAIContext` hook, dogfood the contract |

Track as **HUD-006 Phase 5** (AppShell integration) with Contextual as acceptance app. Spec reference: `hudson/specs/hud-006-ai-backends.md`.

### Domain toolset (initial set)

Tools should **do things in Explore**, not just answer questions:

| Tool | Purpose |
| --- | --- |
| `select_session` | Load transcript by id/path |
| `select_atom` | Focus a context atom in tree + editor |
| `set_window_mode` | pinned / tail / chronological |
| `expand_path` / `collapse_path` | Tree navigation |
| `attach_atoms_to_context` | Pin atoms for model context on next turn |
| `summarize_bucket` | Policy, verification, codebase, etc. |
| `compare_atoms` | Diff two slices |
| `quote_verbatim` | Pull exact transcript text server-side (no paraphrase) |

Shell navigation stays on **`intents`** (open session, toggle panel, jump to atom via command palette).

### Session APIs (migrate from Vite plugin)

**Do not copy `vite-plugin-backends.ts` wholesale.** Extract framework-neutral modules under `src/server/`, then thin Next route handlers.

Lift into Next routes (Node runtime — reads `~/.contextual` and transcript files, not Edge):

- Session catalog (disk cache at `~/.contextual/session-catalog.json`, bounded concurrency, head-read title inference)
- Session pull / analysis payload
- Verbatim atom bodies; `excerptTruncated` only when **source/harness** clipped, not Contextual
- Classifier heuristics remain server-side; buckets are Contextual's proprietary view

Split today's plugin into separate modules: catalog, analysis, OAuth/credentials, ask (delete ask last).

### Data model principles (unchanged)

- Atoms are **verbatim from transcript**; Contextual does not silently clip for display
- Window simulation is **retrospective packing** (pinned + tail + chronological mode) — not "what the model saw on turn N"
- Badges: "contextual model" vs "source clipped" must stay honest

## Phased delivery

### Phase 1 — Shell + APIs (no AI swap)

- [x] Add Next 16 host: `app/page.tsx`, `app/globals.css`, `next.config`
- [x] Define `contextualApp: HudsonApp` with Provider + slots (Explore only)
- [x] Mount `<AppShell app={contextualApp} assistant={false} />`
- [x] Port Explore → `slots.Content`; session catalog → `LeftPanel`; allocation → `Inspector`
- [x] Session API routes via `@/server/session-analysis` (re-exports from vite-plugin for now)
- [x] Hide context console in AppShell path (`showContextConsole={false}`)
- [x] Full server extraction from vite-plugin into `src/server/` (Codex slice)
- [ ] Remove custom `App.tsx` shell from active dev path (legacy `dev:vite` remains)
- [ ] Verify catalog perf (disk cache warm path) still holds

### Phase 2 — Hudson AI

- [ ] Add `app/api/ai/chat/route.ts` (adapt Hudson route; resolve async OAuth vs sync credentials)
- [ ] Register `contextual` toolset via `@hudsonkit/ai/toolsets` portable registry
- [ ] Implement `useContextualExploreAI` + first tools (`select_session`, `select_atom`, `set_window_mode`, `attach_atoms_to_context`)
- [ ] Wire `ContextualChat` in Inspector (or custom drawer)
- [ ] Delete `/api/session-analysis/ask` and remaining ask code

### Phase 3 — Polish + extensions

- [ ] Remaining contextual tools (`summarize_bucket`, `compare_atoms`, `quote_verbatim`)
- [ ] Optional `agentContext` on `HudsonApp`
- [ ] Optional ports: `session-summary`, `window-allocation`
- [ ] Raw session / exit-hash view as command or port (back-pocket)
- [ ] Optional relay + terminal slot (Logos pattern)

### Phase 4 — Decommission standalone artifacts

- [ ] Remove Vite config, plugin, ensure-hudsonkit-styles hack
- [ ] Archive or delete Work/Packages modes unless spun out as separate apps

## First PR scope (smallest shippable slice)

Per @contextual-codex review — proves shell/API migration without throwaway AI plumbing:

1. Next 16 host + hudsonkit styles
2. `contextualApp` with Provider, Content, LeftPanel, Inspector
3. `<AppShell assistant={false} />`
4. Session routes only: catalog, pull, session-analysis
5. ContextConsolePanel hidden; no `/ask` port
6. Vite entry inactive, not deleted

## Dependencies

- `hudsonkit` (AppShell, AI, hooks, styles) — file dep from sibling `~/dev/hudson/packages/web/hudsonkit`
- `@hudsonkit/ai` / toolsets registry (HUD-006 naming: spec says `@hudson/ai-backends`; current tree uses `@hudsonkit/ai`)
- `ai`, `@ai-sdk/react` (via hudsonkit transitive)
- Optional later: `@hudson/relay` for PTY terminal

## Resolved decisions (was open questions)

| Question | Decision |
| --- | --- |
| Next vs other host | **Next.js** — only documented path; Vite recreates bespoke-server problem |
| Chat surface | **`ContextualChat`** via **`slots.Chat` + `app.ai`** once upstream lands; interim manual mount |
| Toolset packaging | **In-repo `contextual` toolset**, registered on portable `@hudsonkit/ai/toolsets` registry |
| Phase 1 scope | **Explore-only** — Work/Packages stay in repo, not migrated |
| Monorepo vs sibling | **Sibling repo** (`~/dev/contextual`), file deps on hudsonkit |
| Relay default | **Chat-only v1** — relay optional later; Assistant off to avoid relay noise |

## Risks and gaps

- **AppShell Chat gap** — upstream fix tracked in HUD-006; interim manual mount
- **Assistant state gap** — solved by `hooks.useAIContext` in proposed contract
- **HUD-006 drift** — spec/package names differ; partially landed as `@hudsonkit/ai`
- **Credential adapter** — Contextual async OAuth vs Hudson sync `loadCredentials`; solve in route adapter
- **Node runtime** — session + transcript routes must not use Edge
- **Context size** — summaries in context, verbatim via tools

## Success criteria

- `bun dev` serves Contextual on Next with AppShell chrome
- Explore workbench functional with migrated session APIs
- AI questions go through `/api/ai/chat` + `contextual` toolset (Phase 2+)
- Model tools mutate Explore selection/window state
- No duplicate ask endpoint or custom context console
- Repo does not appear in Hudson default app registry

## Review log

**@contextual-codex** (Scout `flt-mpbxgbjg-xl0p8q`, 2026-05-18): agreed AppShell direction; flagged Chat slot gap, API extraction order, context policy, first-PR scope. Incorporated above.

## References

- `hudson/docs/building-apps.md` — AppShell consumer pattern
- `hudson/docs/building-app-ai.md` — toolset + hook pattern
- `hudson/docs/quickstart.md` — minimal HudsonApp
- `hudson/docs/case-study-premotion.md` — external consumer
- `hudson/packages/web/hudsonkit/src/components/AppShell.tsx` — Assistant wiring (no `slots.Chat`)
- `hudson/app/shell/WorkspaceShell.tsx` — `slots.Chat` wiring (Hudson OS only)
- `hudson/app/apps/logo-designer/` — full app AI reference
- `hudson/app/apps/day-stack/DayStackChat.tsx` — minimal `<AI chat={...} />` pattern
- `hudson/specs/hud-006-ai-backends.md` — backend/toolset portability
- Contextual existing: `src/components/analysis/`, `vite-plugin-backends.ts`, `src/lib/contextTree.ts`
