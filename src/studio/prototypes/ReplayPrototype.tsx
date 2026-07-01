"use client";

// Turn-by-turn Replay — studio prototype (Hybrid layout from docs/design/replay-ui.md).
//
// STUDIO prototype: self-contained. Fetches REAL data client-side from
// GET /api/session-analysis?demo=1 and filters to the Hunt scenario (session ids
// starting "eve-binding--"). Does NOT touch the Explore app, ContextualProvider,
// or the session-analysis server module. Colors reuse the real bucket palette
// (CONTEXT_BUCKETS / bucketMeta) so the swimlanes match the app.
//
// Two synchronized regions driven by ONE shared playhead (turnIndex):
//   A. Overview swimlanes (top)  — one row per lane, atoms as bucket-colored
//      segments in turn order; a single draggable playhead across all rows;
//      atoms <= playhead bright, future dim; running token meter per row.
//   B. Detail strip (bottom)     — a column per lane; this-turn atom(s), a
//      running stacked composition bar (cumulative bucket tokens <= playhead),
//      and running token count.
//
// Toggleable visual variants so there's something to choose between:
//   - segment width:  uniform  ·  token-proportional
//   - density:        instrument (compact)  ·  annotated (comfortable)

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, SkipBack } from "lucide-react";

import {
  CONTEXT_BUCKETS,
  bucketMeta,
  formatAnalysisTokens,
  type ContextAtom,
  type ContextBucketId,
} from "@/lib/sessionAnalysis";

/* ------------------------------------------------------------------ *
 * Minimal shape of the /api/session-analysis payload we consume.
 * (Kept local so the prototype doesn't reach into server types.)
 * ------------------------------------------------------------------ */
interface ReplaySession {
  id: string;
  title: string;
  source: string;
  atoms: ContextAtom[];
}
interface SessionAnalysisPayload {
  sessions: ReplaySession[];
}

const HUNT_PREFIX = "eve-binding--";

/* Per-harness accent so lanes read apart at a glance (chrome only — the
 * segments themselves stay bucket-colored). Keyed by transcript source. */
const LANE_ACCENT: Record<string, string> = {
  codex: "#7cc7ff",
  claude: "#ff8636",
  pi: "#9fe88a",
  grok: "#c0a6ff",
};
function laneAccent(source: string): string {
  return LANE_ACCENT[source] ?? "var(--hg-accent)";
}
function laneName(source: string): string {
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/* ------------------------------------------------------------------ *
 * Timeline model — group a lane's atoms by turnIndex, in order.
 * ------------------------------------------------------------------ */
interface Turn {
  turnIndex: number;
  atoms: ContextAtom[];
  turnTokens: number;
}
interface Lane {
  id: string;
  source: string;
  model: string;
  title: string;
  turns: Turn[];
  turnByIndex: Map<number, Turn>;
  maxTurn: number;
  totalTokens: number;
}

/** Human model tag parsed out of the session id / title (chrome only). */
function modelFromSession(s: ReplaySession): string {
  const tail = s.id.slice(HUNT_PREFIX.length); // e.g. "codex-gpt-5-5"
  const rest = tail.replace(new RegExp(`^${s.source}-?`), "");
  return rest ? rest.replace(/-/g, " ") : s.source;
}

function buildLane(s: ReplaySession): Lane {
  const byIndex = new Map<number, Turn>();
  for (const atom of s.atoms) {
    const t = atom.turnIndex ?? 0;
    let turn = byIndex.get(t);
    if (!turn) {
      turn = { turnIndex: t, atoms: [], turnTokens: 0 };
      byIndex.set(t, turn);
    }
    turn.atoms.push(atom);
    turn.turnTokens += atom.tokens;
  }
  const turns = [...byIndex.values()].sort((a, b) => a.turnIndex - b.turnIndex);
  const maxTurn = turns.length ? turns[turns.length - 1].turnIndex : 0;
  const totalTokens = s.atoms.reduce((sum, a) => sum + a.tokens, 0);
  return {
    id: s.id,
    source: s.source,
    model: modelFromSession(s),
    title: s.title,
    turns,
    turnByIndex: byIndex,
    maxTurn,
    totalTokens,
  };
}

/** Ordered flat atom list per lane, so uniform-width segments are stable. */
function laneAtomsInOrder(lane: Lane): ContextAtom[] {
  return lane.turns.flatMap((t) => t.atoms);
}

/** Cumulative bucket tokens for every atom whose turnIndex <= t. */
function compositionThrough(lane: Lane, t: number): Map<ContextBucketId, number> {
  const acc = new Map<ContextBucketId, number>();
  for (const turn of lane.turns) {
    if (turn.turnIndex > t) break;
    for (const atom of turn.atoms) {
      acc.set(atom.bucket, (acc.get(atom.bucket) ?? 0) + atom.tokens);
    }
  }
  return acc;
}
function sumMap(m: Map<ContextBucketId, number>): number {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

/* ------------------------------------------------------------------ *
 * Variants.
 * ------------------------------------------------------------------ */
type SegmentWidth = "uniform" | "proportional";
type Density = "instrument" | "annotated";

interface DensityTokens {
  laneRowH: number;
  laneGap: number;
  segH: number;
  labelW: number;
  showModel: boolean;
  detailPad: string;
}
const DENSITY: Record<Density, DensityTokens> = {
  instrument: {
    laneRowH: 34,
    laneGap: 8,
    segH: 18,
    labelW: 118,
    showModel: false,
    detailPad: "px-3 py-2.5",
  },
  annotated: {
    laneRowH: 46,
    laneGap: 12,
    segH: 26,
    labelW: 150,
    showModel: true,
    detailPad: "px-4 py-3.5",
  },
};

/* ------------------------------------------------------------------ *
 * Local palette — scoped to the prototype container only. Same treatment as
 * PackageViewPrototype: a crisper dark base than default so segments pop.
 * ------------------------------------------------------------------ */
const REPLAY_PALETTE = {
  "--hg-bg": "#0d1117",
  "--hg-bg-tint": "#161c24",
  "--hg-surface": "#1b232c",
  "--hg-surface-2": "#212b35",
  "--hg-ink": "#f2f6fa",
  "--hg-ink-2": "#c7d1db",
  "--hg-muted": "#8b97a4",
  "--hg-line": "#2c3742",
  "--hg-hairline": "#41505d",
  "--hg-accent": "#ff8636",
} as CSSProperties;

/* ================================================================== *
 * Page
 * ================================================================== */
export function ReplayPrototype() {
  return (
    <main className="px-7 pt-5 pb-10 md:px-10">
      <header className="mb-4 max-w-[860px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint">
          prototype · turn-by-turn replay
        </div>
        <h1 className="mt-2 text-[20px] font-medium leading-[1.3] text-studio-ink-strong">
          Four harnesses, one task, scrubbed in lockstep.
        </h1>
        <p className="mt-2 text-[13px] leading-[1.6] text-studio-ink-faint">
          The Hunt scenario ran the <b className="text-studio-ink">same</b> binding bug through codex,
          claude, pi, and grok. One shared playhead steps every lane by turn index; the swimlanes show
          each lane accruing context as bucket-colored segments, and the detail strip reads out this
          turn&apos;s action and the running composition. Real data from{" "}
          <code className="font-mono text-[11.5px] text-studio-ink">/api/session-analysis?demo=1</code>.
        </p>
      </header>
      <ReplayStage />
    </main>
  );
}

/* ================================================================== *
 * Stage — data fetch + shared playhead state.
 * ================================================================== */
function ReplayStage() {
  const [lanes, setLanes] = useState<Lane[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [segmentWidth, setSegmentWidth] = useState<SegmentWidth>("proportional");
  const [density, setDensity] = useState<Density>("annotated");

  const [turn, setTurn] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session-analysis?demo=1")
      .then((r) => {
        if (!r.ok) throw new Error(`session analysis failed: ${r.status}`);
        return r.json() as Promise<SessionAnalysisPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        const hunt = payload.sessions
          .filter((s) => s.id.startsWith(HUNT_PREFIX))
          .map(buildLane)
          // codex · claude · pi · grok reads best in that order
          .sort((a, b) => laneRank(a.source) - laneRank(b.source));
        if (!hunt.length) {
          setError("No Hunt-scenario sessions (eve-binding--*) in the demo corpus.");
          return;
        }
        setLanes(hunt);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const maxTurn = useMemo(
    () => (lanes ? Math.max(...lanes.map((l) => l.maxTurn)) : 0),
    [lanes],
  );

  const step = useCallback(
    (dir: 1 | -1) => setTurn((t) => Math.min(maxTurn, Math.max(0, t + dir))),
    [maxTurn],
  );

  // auto-advance
  useEffect(() => {
    if (!playing) return;
    if (turn >= maxTurn) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setTurn((t) => Math.min(maxTurn, t + 1)), 520);
    return () => window.clearTimeout(id);
  }, [playing, turn, maxTurn]);

  // keyboard: space, arrows
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        step(-1);
      }
    },
    [step],
  );

  if (error) {
    return (
      <div style={REPLAY_PALETTE} className="rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] px-5 py-6 text-[13px] text-[var(--hg-ink-2)]">
        <div className="hg-mono text-[10px] uppercase tracking-[0.12em] text-[var(--hg-accent)]">replay unavailable</div>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  if (!lanes) {
    return (
      <div style={REPLAY_PALETTE} className="flex h-[520px] items-center justify-center rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] text-[var(--hg-muted)]">
        <span className="inline-flex items-center gap-2 hg-mono text-[11px] uppercase tracking-[0.12em]">
          <Loader2 size={14} className="animate-spin" /> loading hunt scenario…
        </span>
      </div>
    );
  }

  return (
    <div
      style={REPLAY_PALETTE}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col overflow-hidden rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] text-[var(--hg-ink)] shadow-2xl outline-none focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)]"
    >
      <VariantBar
        segmentWidth={segmentWidth}
        setSegmentWidth={setSegmentWidth}
        density={density}
        setDensity={setDensity}
        laneCount={lanes.length}
      />
      <Transport
        turn={turn}
        maxTurn={maxTurn}
        playing={playing}
        onPlayToggle={() => setPlaying((p) => !p)}
        onStep={(d) => {
          setPlaying(false);
          step(d);
        }}
        onReset={() => {
          setPlaying(false);
          setTurn(0);
        }}
      />
      <Swimlanes
        lanes={lanes}
        turn={turn}
        maxTurn={maxTurn}
        segmentWidth={segmentWidth}
        density={density}
        onScrub={(t) => {
          setPlaying(false);
          setTurn(t);
        }}
      />
      <DetailStrip lanes={lanes} turn={turn} density={density} />
    </div>
  );
}

function laneRank(source: string): number {
  const order = ["codex", "claude", "pi", "grok"];
  const i = order.indexOf(source);
  return i === -1 ? order.length : i;
}

/* ================================================================== *
 * Variant toggle bar.
 * ================================================================== */
function VariantBar({
  segmentWidth,
  setSegmentWidth,
  density,
  setDensity,
  laneCount,
}: {
  segmentWidth: SegmentWidth;
  setSegmentWidth: (v: SegmentWidth) => void;
  density: Density;
  setDensity: (v: Density) => void;
  laneCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] px-4 py-2.5">
      <span className="hg-mono text-[10px] uppercase tracking-[0.14em] text-[var(--hg-muted)]">
        hunt · {laneCount} lanes
      </span>

      <SegToggle
        label="segments"
        value={segmentWidth}
        onChange={setSegmentWidth}
        options={[
          { id: "uniform", label: "uniform" },
          { id: "proportional", label: "∝ tokens" },
        ]}
      />
      <SegToggle
        label="density"
        value={density}
        onChange={setDensity}
        options={[
          { id: "instrument", label: "instrument" },
          { id: "annotated", label: "annotated" },
        ]}
      />

      <span className="ml-auto hg-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
        space play · ← → step · drag playhead
      </span>
    </div>
  );
}

function SegToggle<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="hg-mono text-[9px] uppercase tracking-[0.12em] text-[var(--hg-muted)]">{label}</span>
      <div className="flex rounded-[3px] border border-[var(--hg-hairline)] p-0.5">
        {options.map((opt) => {
          const on = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={
                "hg-mono rounded-[2px] px-2 py-0.5 text-[9.5px] uppercase tracking-[0.06em] transition-colors " +
                (on
                  ? "bg-[var(--hg-accent)] font-semibold text-[#0a0d10]"
                  : "text-[var(--hg-muted)] hover:text-[var(--hg-ink-2)]")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Transport controls + turn counter.
 * ================================================================== */
function Transport({
  turn,
  maxTurn,
  playing,
  onPlayToggle,
  onStep,
  onReset,
}: {
  turn: number;
  maxTurn: number;
  playing: boolean;
  onPlayToggle: () => void;
  onStep: (d: 1 | -1) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--hg-line)] bg-[var(--hg-surface)] px-4 py-2">
      <IconBtn label="restart" onClick={onReset} disabled={turn === 0}>
        <SkipBack size={13} />
      </IconBtn>
      <IconBtn label="step back" onClick={() => onStep(-1)} disabled={turn === 0}>
        <ChevronLeft size={15} />
      </IconBtn>
      <button
        type="button"
        onClick={onPlayToggle}
        aria-label={playing ? "pause" : "play"}
        className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[var(--hg-accent)] text-[#0a0d10] transition-colors hover:opacity-90"
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <IconBtn label="step forward" onClick={() => onStep(1)} disabled={turn >= maxTurn}>
        <ChevronRight size={15} />
      </IconBtn>

      <div className="ml-3 flex items-baseline gap-1.5">
        <span className="hg-mono text-[9px] uppercase tracking-[0.14em] text-[var(--hg-muted)]">turn</span>
        <span className="hg-mono text-[15px] font-semibold tabular-nums leading-none text-[var(--hg-ink)]">
          {String(turn).padStart(2, "0")}
        </span>
        <span className="hg-mono text-[11px] tabular-nums text-[var(--hg-muted)]">/ {maxTurn}</span>
      </div>

      <span className="ml-auto hg-mono text-[9px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
        aligned by turn index
      </span>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[var(--hg-line)] text-[var(--hg-ink-2)] transition-colors hover:border-[var(--hg-hairline)] hover:text-[var(--hg-ink)] disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/* ================================================================== *
 * A. Overview swimlanes + the shared playhead.
 * ================================================================== */
function Swimlanes({
  lanes,
  turn,
  maxTurn,
  segmentWidth,
  density,
  onScrub,
}: {
  lanes: Lane[];
  turn: number;
  maxTurn: number;
  segmentWidth: SegmentWidth;
  density: Density;
  onScrub: (t: number) => void;
}) {
  const d = DENSITY[density];
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // fraction 0..1 of the playhead across the shared axis
  const frac = maxTurn > 0 ? turn / maxTurn : 0;

  const turnFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return turn;
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(p * maxTurn);
    },
    [maxTurn, turn],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
      onScrub(turnFromClientX(e.clientX));
    },
    [onScrub, turnFromClientX],
  );
  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragging) return;
      onScrub(turnFromClientX(e.clientX));
    },
    [dragging, onScrub, turnFromClientX],
  );
  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);
  }, []);

  // milestone markers auto-derived from buckets across all lanes:
  // first collaboration (handoff read), first verification, first codebase edit.
  const markers = useMemo(() => deriveMarkers(lanes, maxTurn), [lanes, maxTurn]);

  return (
    <section className="border-b border-[var(--hg-hairline)] bg-[var(--hg-bg)]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <span className="hg-section-label">overview · accrual by turn</span>
        <BucketLegend lanes={lanes} />
      </div>

      <div className="relative px-4 pb-4 pt-1">
        {/* the shared, draggable playhead track sits over all lane rows */}
        <div
          className="relative"
          style={{ paddingLeft: d.labelW, paddingRight: 74 }}
        >
          {/* interactive track (only the plotting area, excluding label + meter gutters) */}
          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={"absolute inset-y-0 z-20 cursor-ew-resize " + (dragging ? "select-none" : "")}
            style={{ left: d.labelW, right: 74 }}
            role="slider"
            aria-label="playhead"
            aria-valuemin={0}
            aria-valuemax={maxTurn}
            aria-valuenow={turn}
          />

          {/* marker ticks on the axis */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ left: d.labelW, right: 74 }}>
            {markers.map((m) => (
              <div
                key={m.label}
                className="absolute -top-0.5 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${(m.turn / Math.max(1, maxTurn)) * 100}%` }}
                title={`${m.label} · turn ${m.turn}`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
              </div>
            ))}
          </div>

          {/* the playhead line */}
          <div
            className="pointer-events-none absolute z-30 flex flex-col items-center"
            style={{
              left: `calc(${d.labelW}px + (100% - ${d.labelW + 74}px) * ${frac})`,
              top: -4,
              bottom: 0,
            }}
          >
            <span className="h-2 w-2 -translate-y-1 rotate-45 rounded-[1px] bg-[var(--hg-accent)]" />
            <span className="w-px flex-1 bg-[var(--hg-accent)]" />
          </div>

          {/* lane rows */}
          <div className="flex flex-col" style={{ gap: d.laneGap }}>
            {lanes.map((lane) => (
              <LaneRow
                key={lane.id}
                lane={lane}
                turn={turn}
                maxTurn={maxTurn}
                segmentWidth={segmentWidth}
                density={density}
              />
            ))}
          </div>
        </div>

        {/* axis marker labels */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ paddingLeft: d.labelW }}>
          {markers.map((m) => (
            <span key={m.label} className="inline-flex items-center gap-1.5 hg-mono text-[9px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
              {m.label} · t{m.turn}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function LaneRow({
  lane,
  turn,
  maxTurn,
  segmentWidth,
  density,
}: {
  lane: Lane;
  turn: number;
  maxTurn: number;
  segmentWidth: SegmentWidth;
  density: Density;
}) {
  const d = DENSITY[density];
  const atoms = useMemo(() => laneAtomsInOrder(lane), [lane]);
  const runningTokens = useMemo(() => {
    let s = 0;
    for (const a of atoms) {
      if ((a.turnIndex ?? 0) <= turn) s += a.tokens;
    }
    return s;
  }, [atoms, turn]);

  // where this lane's own last turn falls on the shared axis (for the end-cap)
  const endFrac = maxTurn > 0 ? lane.maxTurn / maxTurn : 1;
  const laneDone = turn >= lane.maxTurn;

  return (
    <div className="flex items-center" style={{ height: d.laneRowH }}>
      {/* lane label */}
      <div className="shrink-0 pr-3" style={{ width: d.labelW }}>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: laneAccent(lane.source) }} />
          <span className="hg-mono text-[11px] font-medium lowercase tracking-[0.02em] text-[var(--hg-ink)]">
            {laneName(lane.source)}
          </span>
        </div>
        {d.showModel && (
          <div className="mt-0.5 pl-3.5 hg-mono text-[8.5px] uppercase tracking-[0.06em] text-[var(--hg-muted)]">
            {lane.model}
          </div>
        )}
      </div>

      {/* segment track — bucket-colored, in turn order */}
      <div className="relative min-w-0 flex-1">
        <div
          className="flex w-full items-stretch overflow-hidden rounded-[3px] bg-[var(--hg-surface)]"
          style={{ height: d.segH }}
        >
          {atoms.map((atom, i) => {
            const meta = bucketMeta(atom.bucket);
            const past = (atom.turnIndex ?? 0) <= turn;
            const flexGrow =
              segmentWidth === "proportional" ? Math.max(1, atom.tokens) : 1;
            return (
              <span
                key={atom.id ?? i}
                title={`${atom.label} · ${meta.label} · ${formatAnalysisTokens(atom.tokens)} · turn ${atom.turnIndex ?? 0}`}
                className="group relative block h-full border-r border-[var(--hg-bg)]/60 transition-opacity last:border-r-0"
                style={{
                  flexGrow,
                  flexBasis: 0,
                  minWidth: 2,
                  background: meta.color,
                  opacity: past ? 1 : 0.16,
                }}
              />
            );
          })}
        </div>

        {/* end-cap for lanes that finish before maxTurn */}
        {lane.maxTurn < maxTurn && (
          <div
            className="pointer-events-none absolute inset-y-0 flex items-center"
            style={{ left: `${endFrac * 100}%` }}
            title={`${laneName(lane.source)} ends at turn ${lane.maxTurn}`}
          >
            <span className="h-full w-px bg-[var(--hg-hairline)]" />
            <span
              className={
                "ml-1 hg-mono text-[8px] uppercase tracking-[0.08em] " +
                (laneDone ? "text-[var(--hg-ink-2)]" : "text-[var(--hg-muted)]")
              }
            >
              done
            </span>
          </div>
        )}
      </div>

      {/* running token meter */}
      <div className="shrink-0 pl-3 text-right" style={{ width: 74 }}>
        <div className="hg-mono text-[10px] font-medium tabular-nums text-[var(--hg-ink)]">
          {formatAnalysisTokens(runningTokens)}
        </div>
        <div className="hg-mono text-[8px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">
          {Math.round((runningTokens / Math.max(1, lane.totalTokens)) * 100)}%
        </div>
      </div>
    </div>
  );
}

/* Compact bucket legend, only the buckets actually present in the scenario. */
function BucketLegend({ lanes }: { lanes: Lane[] }) {
  const present = useMemo(() => {
    const seen = new Set<ContextBucketId>();
    for (const lane of lanes) for (const t of lane.turns) for (const a of t.atoms) seen.add(a.bucket);
    return CONTEXT_BUCKETS.filter((b) => seen.has(b.id));
  }, [lanes]);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {present.map((b) => (
        <span key={b.id} className="inline-flex items-center gap-1 hg-mono text-[8.5px] uppercase tracking-[0.06em] text-[var(--hg-muted)]">
          <span className="h-1.5 w-1.5 rounded-[1px]" style={{ background: b.color }} />
          {b.label}
        </span>
      ))}
    </div>
  );
}

/* Milestone markers auto-derived from buckets (first occurrence across lanes). */
interface Marker {
  label: string;
  turn: number;
  color: string;
}
function deriveMarkers(lanes: Lane[], maxTurn: number): Marker[] {
  const firstTurnWith = (pred: (a: ContextAtom) => boolean): number | null => {
    let best: number | null = null;
    for (const lane of lanes) {
      for (const t of lane.turns) {
        if (t.atoms.some(pred)) {
          best = best === null ? t.turnIndex : Math.min(best, t.turnIndex);
          break;
        }
      }
    }
    return best;
  };
  const out: Marker[] = [];
  const collab = firstTurnWith((a) => a.bucket === "collaboration");
  const verify = firstTurnWith((a) => a.bucket === "verification");
  const code = firstTurnWith((a) => a.bucket === "codebase");
  if (code !== null) out.push({ label: "first read", turn: code, color: bucketMeta("codebase").color });
  if (collab !== null) out.push({ label: "handoff", turn: collab, color: bucketMeta("collaboration").color });
  if (verify !== null) out.push({ label: "first check", turn: verify, color: bucketMeta("verification").color });
  return out.filter((m) => m.turn <= maxTurn);
}

/* ================================================================== *
 * B. Detail strip — a column per lane, aligned under the swimlanes.
 * ================================================================== */
function DetailStrip({ lanes, turn, density }: { lanes: Lane[]; turn: number; density: Density }) {
  // leanest running total this turn (for the Δ divergence cue)
  const runningTotals = useMemo(
    () => lanes.map((l) => sumMap(compositionThrough(l, turn))),
    [lanes, turn],
  );
  const leanest = Math.min(...runningTotals);

  return (
    <section className="bg-[var(--hg-surface-2)]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <span className="hg-section-label">detail · this turn &amp; running composition</span>
        <span className="hg-mono text-[9px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
          turn {String(turn).padStart(2, "0")} · Δ vs leanest lane
        </span>
      </div>
      <div
        className="grid gap-px bg-[var(--hg-line)] px-4 pb-4 pt-1"
        style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}
      >
        {lanes.map((lane, i) => (
          <DetailColumn
            key={lane.id}
            lane={lane}
            turn={turn}
            density={density}
            runningTotal={runningTotals[i]}
            deltaVsLeanest={runningTotals[i] - leanest}
          />
        ))}
      </div>
    </section>
  );
}

function DetailColumn({
  lane,
  turn,
  density,
  runningTotal,
  deltaVsLeanest,
}: {
  lane: Lane;
  turn: number;
  density: Density;
  runningTotal: number;
  deltaVsLeanest: number;
}) {
  const d = DENSITY[density];
  const thisTurn = lane.turnByIndex.get(turn) ?? null;
  const composition = useMemo(() => compositionThrough(lane, turn), [lane, turn]);
  const ordered = useMemo(
    () =>
      CONTEXT_BUCKETS.map((b) => ({ bucket: b.id, color: b.color, tokens: composition.get(b.id) ?? 0 })).filter(
        (x) => x.tokens > 0,
      ),
    [composition],
  );
  const priorCount = useMemo(() => {
    let c = 0;
    for (const t of lane.turns) {
      if (t.turnIndex >= turn) break;
      c += t.atoms.length;
    }
    return c;
  }, [lane, turn]);

  const done = turn >= lane.maxTurn;
  const beforeStart = turn < (lane.turns[0]?.turnIndex ?? 0);

  return (
    <div className={"flex flex-col bg-[var(--hg-surface-2)] " + d.detailPad}>
      {/* lane header */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: laneAccent(lane.source) }} />
        <span className="hg-mono text-[11px] font-medium text-[var(--hg-ink)]">{laneName(lane.source)}</span>
        <span className="ml-auto hg-mono text-[8.5px] uppercase tracking-[0.06em] text-[var(--hg-muted)]">
          {lane.model}
        </span>
      </div>

      {/* this turn's action(s) */}
      <div className="min-h-[52px]">
        {beforeStart ? (
          <div className="hg-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">not started</div>
        ) : thisTurn ? (
          <div className="flex flex-col gap-1.5">
            {thisTurn.atoms.slice(0, density === "annotated" ? 3 : 2).map((atom) => {
              const meta = bucketMeta(atom.bucket);
              return (
                <div key={atom.id} className="flex items-start gap-2">
                  <span
                    className="mt-[3px] h-2 w-2 shrink-0 rounded-[1px]"
                    style={{ background: meta.color }}
                    title={meta.label}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[11.5px] leading-[1.3] text-[var(--hg-ink)]" title={atom.label}>
                      {atom.label}
                    </div>
                    <div className="hg-mono text-[8.5px] uppercase tracking-[0.06em] text-[var(--hg-muted)]">
                      {meta.label} · {formatAnalysisTokens(atom.tokens)}
                    </div>
                  </div>
                </div>
              );
            })}
            {thisTurn.atoms.length > (density === "annotated" ? 3 : 2) && (
              <div className="hg-mono text-[8.5px] uppercase tracking-[0.06em] text-[var(--hg-muted)]">
                +{thisTurn.atoms.length - (density === "annotated" ? 3 : 2)} more this turn
              </div>
            )}
          </div>
        ) : (
          <div className="hg-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">
            {done ? "— done —" : "idle this turn"}
          </div>
        )}
      </div>

      {/* running composition — stacked bar of cumulative bucket tokens <= turn */}
      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="hg-mono text-[8.5px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">running</span>
          <span className="hg-mono text-[10px] font-medium tabular-nums text-[var(--hg-ink)]">
            {formatAnalysisTokens(runningTotal)}
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-[2px] bg-[var(--hg-bg)]">
          {ordered.map((seg) => (
            <span
              key={seg.bucket}
              title={`${bucketMeta(seg.bucket).label} · ${formatAnalysisTokens(seg.tokens)}`}
              style={{
                flexGrow: seg.tokens,
                flexBasis: 0,
                background: seg.color,
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="hg-mono text-[8.5px] uppercase tracking-[0.06em] text-[var(--hg-muted)]">
            ⋯ {priorCount} prior atom{priorCount === 1 ? "" : "s"}
          </span>
          <span
            className={
              "hg-mono text-[8.5px] uppercase tracking-[0.06em] " +
              (deltaVsLeanest === 0 ? "text-[var(--hg-ink-2)]" : "text-[var(--hg-muted)]")
            }
          >
            {deltaVsLeanest === 0 ? "leanest" : `+${formatAnalysisTokens(deltaVsLeanest)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
