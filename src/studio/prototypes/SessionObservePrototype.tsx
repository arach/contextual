"use client";

// Single session — turns × accumulation (studio prototype SHELL).
//
// The reusable INSTRUMENT (header + accumulation mountain + transport +
// timeline + per-turn impact + footer for ONE session) now lives in the shared
// component `@/components/analysis/SessionReplay`, so the studio route and the
// main Explore workbench render the exact same thing with no duplicated logic.
//
// This file keeps only the studio SHELL around that instrument:
//   • ObserveStage — fetches REAL data client-side from
//     GET /api/session-analysis?demo=1, filters to the real capture corpus
//     (eve-relay--* / eve-binding--*), and auto-selects the session with the
//     MOST distinct turnIndex values (richest conversation).
//   • ObserveWorkspace — joins the LEFT session list to the instrument.
//   • SessionList / SessionCompactSelector — the LEFT session picker. This is
//     the ONLY place session selection lives.
//
// RESPONSIVE (shell only) — the shell's own layout is keyed off the VIEWPORT,
// which is fine here because the studio page is full-width:
//   • ≥ 1440px : left list column beside the instrument.
//   • 1000–1440: left list column beside the instrument (impact collapses
//     inside the instrument via its own container measurement).
//   • < 1000px : left list collapses to a compact selector; instrument stacks
//     beneath it.
// The instrument itself is CONTAINER-responsive (it measures its own width), so
// its impact column collapses correctly even inside the narrower Explore embed.

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import {
  OBSERVE_PALETTE,
  SessionReplay,
  distinctTurns,
  sourceAccent,
  sourceName,
  type ObserveSession,
} from "@/components/analysis/SessionReplay";

/* ------------------------------------------------------------------ *
 * Payload shape we consume (kept local — no reach into server types).
 * ------------------------------------------------------------------ */
interface SessionAnalysisPayload {
  sessions: ObserveSession[];
}

/** Which sessions form the real capture corpus. */
const REAL_CORPUS_PREFIXES = ["eve-relay--", "eve-binding--"];

/** Sort tiebreak — total tokens across all atoms. */
function totalTokens(s: ObserveSession): number {
  let total = 0;
  for (const a of s.atoms) total += a.tokens;
  return total;
}

/** Display model label — mirrors the instrument's own `humanModel`. */
function modelLabel(s: ObserveSession): string {
  if (s.model) return s.model;
  const tail = s.id.split("--")[1] ?? s.source;
  return tail.replace(new RegExp(`^${s.source}-?`), "").replace(/-/g, " ") || s.source;
}

/* ------------------------------------------------------------------ *
 * Responsive tier — SHELL layout only, keyed off the VIEWPORT (the studio page
 * is full-width, so this is correct here). The instrument does its OWN
 * container-based measurement. Driven by matchMedia so it is a true viewport
 * query. SSR-safe: renders "wide" on the server / first paint, then corrects.
 * ------------------------------------------------------------------ */
type ViewportTier = "narrow" | "mid" | "wide";
const MID_MIN_PX = 1000;
const WIDE_MIN_PX = 1440;

function tierFor(width: number): ViewportTier {
  if (width >= WIDE_MIN_PX) return "wide";
  if (width >= MID_MIN_PX) return "mid";
  return "narrow";
}

function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>("wide");
  useEffect(() => {
    const midQuery = window.matchMedia(`(min-width: ${MID_MIN_PX}px)`);
    const wideQuery = window.matchMedia(`(min-width: ${WIDE_MIN_PX}px)`);
    const sync = () => setTier(tierFor(window.innerWidth));
    sync();
    midQuery.addEventListener("change", sync);
    wideQuery.addEventListener("change", sync);
    return () => {
      midQuery.removeEventListener("change", sync);
      wideQuery.removeEventListener("change", sync);
    };
  }, []);
  return tier;
}

/* ================================================================== *
 * Page
 * ================================================================== */
export function SessionObservePrototype() {
  return (
    <main className="px-7 pt-5 pb-10 md:px-10">
      <header className="mb-4 max-w-[880px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint">
          prototype · single session — turns × accumulation
        </div>
        <h1 className="mt-2 text-[20px] font-medium leading-[1.3] text-studio-ink-strong">
          One session, turn by turn: the conversation, and what it accumulated.
        </h1>
        <p className="mt-2 text-[13px] leading-[1.6] text-studio-ink-faint">
          Pick a session from the <b className="text-studio-ink">list on the left</b>. The stat-bar
          and the <b className="text-studio-ink">accumulation</b> mountain stay pinned above; the{" "}
          <b className="text-studio-ink">conversation</b> scrolls beneath. Use the{" "}
          <b className="text-studio-ink">transport</b> to play (auto-advance one turn at a time),
          pause, or step — or scroll the log and the playhead follows; click a turn and the log jumps
          to it. A side panel reports the <b className="text-studio-ink">impact of the current turn</b>{" "}
          and the window as of that turn. Each turn is a neutral marker:{" "}
          <b className="text-studio-ink">who spoke</b>, a short gist, and{" "}
          <b className="text-studio-ink">how much it added</b>. Real data from{" "}
          <code className="font-mono text-[11.5px] text-studio-ink">/api/session-analysis?demo=1</code>.
        </p>
      </header>
      <ObserveStage />
    </main>
  );
}

/* ================================================================== *
 * Stage — fetch, session selection.
 * ================================================================== */
function ObserveStage() {
  const [sessions, setSessions] = useState<ObserveSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session-analysis?demo=1")
      .then((r) => {
        if (!r.ok) throw new Error(`session analysis failed: ${r.status}`);
        return r.json() as Promise<SessionAnalysisPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        const corpus = payload.sessions
          .filter((s) => REAL_CORPUS_PREFIXES.some((p) => s.id.startsWith(p)))
          .filter((s) => s.atoms.length > 0)
          // most distinct turns first — richest conversation; ties by total tokens
          .sort((a, b) => distinctTurns(b) - distinctTurns(a) || totalTokens(b) - totalTokens(a));
        if (!corpus.length) {
          setError("No real-corpus sessions (eve-relay--* / eve-binding--*) in the demo payload.");
          return;
        }
        setSessions(corpus);
        setActiveId(corpus[0].id); // default = richest turn-by-turn structure
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => sessions?.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  if (error) {
    return (
      <div
        style={OBSERVE_PALETTE}
        className="rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] px-5 py-6 text-[13px] text-[var(--hg-ink-2)]"
      >
        <div className="hg-mono text-[10px] uppercase tracking-[0.12em] text-[var(--hg-accent)]">
          instrument unavailable
        </div>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  if (!sessions || !active) {
    return (
      <div
        style={OBSERVE_PALETTE}
        className="flex h-[560px] items-center justify-center rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] text-[var(--hg-muted)]"
      >
        <span className="inline-flex items-center gap-2 hg-mono text-[11px] uppercase tracking-[0.12em]">
          <Loader2 size={14} className="animate-spin" /> loading session…
        </span>
      </div>
    );
  }

  return <ObserveWorkspace active={active} sessions={sessions} onPick={setActiveId} />;
}

/* ================================================================== *
 * Workspace — joins the LEFT session list to the shared instrument, laid out
 * off the viewport tier. narrow → stacked (compact selector above the tool);
 * mid/wide → side-by-side (full list column beside the tool).
 * ================================================================== */
function ObserveWorkspace({
  active,
  sessions,
  onPick,
}: {
  active: ObserveSession;
  sessions: ObserveSession[];
  onPick: (id: string) => void;
}) {
  const tier = useViewportTier();
  const stacked = tier === "narrow";

  return (
    <div
      style={OBSERVE_PALETTE}
      className={"flex items-stretch " + (stacked ? "flex-col gap-3" : "flex-row gap-4")}
    >
      {/* LEFT SESSION LIST — full column ≥ 1000px; a compact selector below. */}
      <SessionList sessions={sessions} activeId={active.id} onPick={onPick} tier={tier} />
      <div className="min-w-0 flex-1">
        <SessionReplay key={active.id} session={active} />
      </div>
    </div>
  );
}

/* ================================================================== *
 * Session list (LEFT). The ONLY place session selection lives. A vertical
 * column of sessions: title, `harness · model`, turn-count badge; the active
 * one carries an accent left-border + tint. Picking one switches the instrument
 * (which resets the cursor to the first turn via its `key`). At full width it is
 * a ~210px scroll column; below 1000px it collapses to a compact dropdown so the
 * instrument keeps the room.
 * ================================================================== */
function SessionList({
  sessions,
  activeId,
  onPick,
  tier,
}: {
  sessions: ObserveSession[];
  activeId: string;
  onPick: (id: string) => void;
  tier: ViewportTier;
}) {
  // narrow → a compact dropdown so the instrument keeps the room;
  // mid/wide → the full ~210px scroll column.
  if (tier === "narrow") {
    return <SessionCompactSelector sessions={sessions} activeId={activeId} onPick={onPick} />;
  }

  return (
    /* Full list column — the ≥ 1000px layout. */
    <aside className="flex w-[210px] shrink-0 flex-col overflow-hidden rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] xl:w-[220px]">
      <div className="border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-3 py-2.5">
        <span className="hg-section-label">sessions · {sessions.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        <div className="flex flex-col gap-1.5">
          {sessions.map((s) => {
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s.id)}
                aria-current={isActive}
                title={s.title}
                className={
                  "group flex w-full items-start gap-2 rounded-[5px] border-l-2 py-2 pl-2 pr-2 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)] " +
                  (isActive
                    ? "border-l-[var(--hg-accent)] bg-[var(--hg-surface-2)]"
                    : "border-l-transparent bg-[var(--hg-surface)] hover:border-l-[var(--hg-hairline)] hover:bg-[var(--hg-surface-2)]")
                }
              >
                <span
                  className="mt-[3px] h-2 w-2 shrink-0 rounded-full"
                  style={{ background: sourceAccent(s.source) }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      "block truncate text-[12px] font-medium leading-tight " +
                      (isActive ? "text-[var(--hg-ink)]" : "text-[var(--hg-ink-2)]")
                    }
                  >
                    {s.title}
                  </span>
                  <span className="mt-1 block truncate hg-mono text-[9px] lowercase tracking-[0.02em] text-[var(--hg-muted)]">
                    {sourceName(s.source)} · {modelLabel(s)}
                  </span>
                </span>
                <span
                  className={
                    "mt-[1px] shrink-0 rounded-[3px] px-1.5 py-0.5 hg-mono text-[9px] tabular-nums " +
                    (isActive
                      ? "bg-[var(--hg-accent)] text-[#0a0d10]"
                      : "bg-[var(--hg-bg)] text-[var(--hg-muted)]")
                  }
                >
                  {distinctTurns(s)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/** Compact session dropdown — the < 1000px stand-in for the left list column. */
function SessionCompactSelector({
  sessions,
  activeId,
  onPick,
}: {
  sessions: ObserveSession[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  const active = sessions.find((s) => s.id === activeId);
  return (
    <div className="flex items-center gap-2 rounded-[6px] border border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] px-3 py-2">
      <span className="hg-mono text-[9px] uppercase tracking-[0.12em] text-[var(--hg-muted)]">
        session
      </span>
      <label className="relative flex min-w-0 flex-1 items-center">
        <span
          className="mr-2 h-2 w-2 shrink-0 rounded-full"
          style={{ background: sourceAccent(active?.source ?? "") }}
        />
        <select
          value={activeId}
          onChange={(e) => onPick(e.target.value)}
          aria-label="session"
          className="min-w-0 flex-1 cursor-pointer appearance-none truncate rounded-[4px] border border-[var(--hg-line)] bg-[var(--hg-surface)] py-1 pl-2.5 pr-7 text-[12px] font-medium text-[var(--hg-ink)] outline-none transition-colors hover:border-[var(--hg-hairline)] focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)]"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {sourceName(s.source)} · {distinctTurns(s)} turns
            </option>
          ))}
        </select>
        <ChevronRight
          size={13}
          className="pointer-events-none absolute right-2 rotate-90 text-[var(--hg-muted)]"
        />
      </label>
    </div>
  );
}
