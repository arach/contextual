"use client";

// Full-bleed Session Replay surface. Mounted by the Hudson shell's Takeover slot
// (see contextualApp.slots.Takeover + hooks.useTakeover) whenever `replaySessionId`
// resolves to a loaded session, so the reusable SessionReplay instrument gets the
// full viewport width — wide enough for the per-turn impact column, which is the
// whole point of this surface. The shell owns Escape + focus + the inert
// background; the back control here mirrors Escape via closeReplay.
//
// SessionReplay measures its OWN container (ResizeObserver), so full-bleed → wide
// tier → the impact column shows; a narrower viewport collapses it inline.

import { ArrowLeft } from "lucide-react";

import { useContextualApp } from "@/contextualApp/ContextualProvider";
import {
  OBSERVE_PALETTE,
  SessionReplay,
  sourceAccent,
  sourceName,
} from "@/components/analysis/SessionReplay";

/** Derive a light model label from the session id (Contextual has no model field),
 *  matching the instrument's own derivation. Omitted when it just echoes the harness. */
function modelLabel(id: string, source: string): string | null {
  const derived = (id.split("--")[1] ?? "")
    .replace(new RegExp(`^${source}-?`), "")
    .replace(/-/g, " ")
    .trim();
  return derived && derived !== source ? derived : null;
}

export function SessionReplaySurface() {
  const { replaySessionId, closeReplay, explore } = useContextualApp();
  const session = explore.sessions.find((item) => item.id === replaySessionId) ?? null;

  // Deep-link before the corpus loads: useTakeover only mounts this slot once the
  // session resolves, but stay defensive and pass through cleanly if it doesn't.
  if (!session) return null;

  const model = modelLabel(session.id, session.source);

  return (
    <div
      style={OBSERVE_PALETTE}
      className="flex h-full min-h-0 flex-col bg-[var(--hg-bg)] text-[var(--hg-ink)]"
    >
      {/* slim top bar — back control · session title · harness · model */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] px-4 py-2.5">
        <button
          type="button"
          onClick={closeReplay}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-[var(--hg-line)] bg-[var(--hg-surface)] px-2.5 py-1.5 hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink-2)] transition-colors hover:border-[var(--hg-hairline)] hover:text-[var(--hg-ink)]"
        >
          <ArrowLeft size={13} />
          Back to Explore
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: sourceAccent(session.source) }}
          />
          <span
            className="truncate text-[13px] font-medium text-[var(--hg-ink)]"
            title={session.title}
          >
            {session.title}
          </span>
          <span className="shrink-0 hg-mono text-[10px] text-[var(--hg-muted)]">
            {sourceName(session.source)}
            {model ? ` · ${model}` : ""}
          </span>
        </div>

        <span className="ml-auto shrink-0 hg-mono text-[9px] uppercase tracking-[0.14em] text-[var(--hg-muted)]">
          Session Replay
        </span>
      </div>

      {/* full-width instrument — its own ResizeObserver picks the tier from this width */}
      <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
        <SessionReplay
          key={session.id}
          session={{
            id: session.id,
            title: session.title,
            source: session.source,
            model: null,
            modelWindow: session.modelWindow,
            atoms: session.atoms,
          }}
        />
      </div>
    </div>
  );
}
