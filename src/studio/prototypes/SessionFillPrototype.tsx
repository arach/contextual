"use client";

// Turn Impact — single-session "turn-by-turn context impact" instrument (studio prototype).
// Spec: docs/design/session-fill-ui.md (superseded direction, noted below).
//
// This is a REPORTING instrument. It reports impact; it does NOT editorialize.
// There is deliberately NO per-turn scoring — a turn is never rated. Each turn is
// a neutral marker: who spoke (user / assistant / tool), its turn index, and how
// much it ADDED to the window. The user scrubs a playhead forward and
// backward across turns, watching the context window accumulate, and can return
// to any earlier turn to see the window's composition as of that turn.
//
// STUDIO prototype: self-contained. Fetches REAL data client-side from
// GET /api/session-analysis?demo=1 and auto-selects the session with the MOST
// distinct turnIndex values (richest turn-by-turn structure). Does NOT touch the
// Explore app, ContextualProvider, or the session-analysis server module. Colors
// reuse the real bucket palette (CONTEXT_BUCKETS / bucketMeta) so it reads native.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  SkipBack,
  User,
  Bot,
  Wrench,
} from "lucide-react";

import {
  CONTEXT_BUCKETS,
  bucketMeta,
  formatAnalysisTokens,
  type ContextAtom,
  type ContextBucketId,
} from "@/lib/sessionAnalysis";

/* ------------------------------------------------------------------ *
 * Payload shape we consume (kept local — no reach into server types).
 * ------------------------------------------------------------------ */
interface FillSession {
  id: string;
  title: string;
  source: string;
  model?: string | null;
  modelWindow?: number | null;
  atoms: ContextAtom[];
}
interface SessionAnalysisPayload {
  sessions: FillSession[];
}

/** Which sessions form the real capture corpus. */
const REAL_CORPUS_PREFIXES = ["eve-relay--", "eve-binding--"];

/* Per-harness accent (chrome only — the plot itself stays bucket-colored). */
const SOURCE_ACCENT: Record<string, string> = {
  codex: "#7cc7ff",
  claude: "#ff8636",
  pi: "#9fe88a",
  grok: "#c0a6ff",
};
function sourceAccent(source: string): string {
  return SOURCE_ACCENT[source] ?? "var(--hg-accent)";
}
function sourceName(source: string): string {
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/* ================================================================== *
 * Role — neutral speaker family. No evaluation; purely descriptive.
 *   user      — user / developer messages
 *   assistant — assistant messages and reasoning
 *   tool      — tool calls and tool outputs
 * ================================================================== */
type RoleKind = "user" | "assistant" | "tool";

const ROLE_META: Record<RoleKind, { label: string; hue: string; Icon: typeof User }> = {
  user: { label: "user", hue: "#8fb4d9", Icon: User },
  assistant: { label: "assistant", hue: "#c8b98f", Icon: Bot },
  tool: { label: "tool", hue: "#8a97a2", Icon: Wrench },
};

function roleOf(atom: ContextAtom): RoleKind {
  if (atom.sourceType === "tool-call" || atom.sourceType === "tool-output") return "tool";
  const r = (atom.role ?? "").toLowerCase();
  if (r === "user" || r === "developer" || r === "human") return "user";
  if (r === "assistant") return "assistant";
  // reasoning / model output without an explicit role reads as assistant
  if (atom.sourceType === "reasoning" || atom.sourceType === "message") return "assistant";
  return "assistant";
}

/** A short, neutral, muted gist for orientation — never the raw message prose. */
function turnGist(row: TurnRow): string {
  // pick the biggest atom's neutral descriptor
  const lead = row.atoms[0];
  if (!lead) return "";
  if (lead.toolName) {
    const arg = lead.command ? basename(lead.command) : "";
    return arg ? `${lead.toolName} · ${arg}` : lead.toolName;
  }
  // for messages, use the neutral label ("user message", "assistant reasoning")
  const label = (lead.label ?? "").trim();
  if (label) return label;
  return bucketMeta(lead.bucket).label;
}
function basename(path: string): string {
  const clean = path.split("?")[0].split("#")[0].replace(/\/+$/, "");
  const seg = clean.split("/").filter(Boolean);
  return seg[seg.length - 1] ?? clean;
}

/* ------------------------------------------------------------------ *
 * Session model — group atoms by turnIndex, precompute accrual.
 * ------------------------------------------------------------------ */
interface TurnRow {
  turnIndex: number;
  role: RoleKind; // dominant role of the turn (by tokens)
  atoms: ContextAtom[];
  delta: number; // tokens added this turn
  /** token delta by bucket for this turn (which buckets grew, by how much). */
  bucketDelta: Map<ContextBucketId, number>;
}
interface SessionModel {
  id: string;
  source: string;
  model: string;
  title: string;
  turns: TurnRow[];
  turnByIndex: Map<number, TurnRow>;
  turnOrder: number[]; // sorted turnIndex values that actually carry atoms
  firstTurn: number;
  maxTurn: number;
  totalTokens: number;
  presentBuckets: ContextBucketId[];
  /** cumulative composition by bucket at the END of each turn row (index-aligned to turns). */
  cumByTurn: Map<ContextBucketId, number>[];
  cumTotalByTurn: number[];
  peakTotal: number;
  peakDelta: number;
  distinctTurns: number;
}

function humanModel(s: FillSession): string {
  if (s.model) return s.model;
  const tail = s.id.split("--")[1] ?? s.source;
  return tail.replace(new RegExp(`^${s.source}-?`), "").replace(/-/g, " ") || s.source;
}

function buildSession(s: FillSession): SessionModel {
  const byIndex = new Map<number, TurnRow>();
  for (const atom of s.atoms) {
    const t = atom.turnIndex ?? 0;
    let row = byIndex.get(t);
    if (!row) {
      row = { turnIndex: t, role: "assistant", atoms: [], delta: 0, bucketDelta: new Map() };
      byIndex.set(t, row);
    }
    row.atoms.push(atom);
    row.delta += atom.tokens;
    row.bucketDelta.set(atom.bucket, (row.bucketDelta.get(atom.bucket) ?? 0) + atom.tokens);
  }

  const turns = [...byIndex.values()].sort((a, b) => a.turnIndex - b.turnIndex);
  for (const t of turns) {
    // biggest atom first so the gist + detail read top-down
    t.atoms.sort((a, b) => b.tokens - a.tokens);
    // dominant role = the role that contributed the most tokens this turn
    const byRole = new Map<RoleKind, number>();
    for (const a of t.atoms) byRole.set(roleOf(a), (byRole.get(roleOf(a)) ?? 0) + a.tokens);
    let best: RoleKind = "assistant";
    let bestTok = -1;
    for (const [role, tok] of byRole) {
      if (tok > bestTok) {
        bestTok = tok;
        best = role;
      }
    }
    t.role = best;
  }

  const turnOrder = turns.map((t) => t.turnIndex);
  const firstTurn = turnOrder.length ? turnOrder[0] : 0;
  const maxTurn = turnOrder.length ? turnOrder[turnOrder.length - 1] : 0;

  let totalTokens = 0;
  for (const a of s.atoms) totalTokens += a.tokens;

  const seen = new Set<ContextBucketId>();
  for (const a of s.atoms) seen.add(a.bucket);
  const presentBuckets = CONTEXT_BUCKETS.filter((b) => seen.has(b.id)).map((b) => b.id);

  const cumByTurn: Map<ContextBucketId, number>[] = [];
  const cumTotalByTurn: number[] = [];
  const running = new Map<ContextBucketId, number>();
  let runningTotal = 0;
  for (const row of turns) {
    for (const a of row.atoms) {
      running.set(a.bucket, (running.get(a.bucket) ?? 0) + a.tokens);
      runningTotal += a.tokens;
    }
    cumByTurn.push(new Map(running));
    cumTotalByTurn.push(runningTotal);
  }

  const peakTotal = cumTotalByTurn.length ? cumTotalByTurn[cumTotalByTurn.length - 1] : 0;
  const peakDelta = turns.reduce((m, t) => Math.max(m, t.delta), 0);

  return {
    id: s.id,
    source: s.source,
    model: humanModel(s),
    title: s.title,
    turns,
    turnByIndex: byIndex,
    turnOrder,
    firstTurn,
    maxTurn,
    totalTokens,
    presentBuckets,
    cumByTurn,
    cumTotalByTurn,
    peakTotal,
    peakDelta,
    distinctTurns: turnOrder.length,
  };
}

/** Row index of the last turn with turnIndex <= t (or -1 before the first turn). */
function rowIndexAt(model: SessionModel, turnIndex: number): number {
  let rowIdx = -1;
  for (let i = 0; i < model.turns.length; i++) {
    if (model.turns[i].turnIndex <= turnIndex) rowIdx = i;
    else break;
  }
  return rowIdx;
}

/** Composition at (or before) a given turnIndex. */
function compositionAt(
  model: SessionModel,
  turnIndex: number,
): { comp: Map<ContextBucketId, number>; total: number } {
  const rowIdx = rowIndexAt(model, turnIndex);
  if (rowIdx < 0) return { comp: new Map(), total: 0 };
  return { comp: model.cumByTurn[rowIdx], total: model.cumTotalByTurn[rowIdx] };
}

/* ------------------------------------------------------------------ *
 * Local palette — scoped to the prototype container (matches siblings).
 * ------------------------------------------------------------------ */
const FILL_PALETTE = {
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
export function SessionFillPrototype() {
  return (
    <main className="px-7 pt-5 pb-10 md:px-10">
      <header className="mb-4 max-w-[880px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint">
          prototype · turn impact — single session
        </div>
        <h1 className="mt-2 text-[20px] font-medium leading-[1.3] text-studio-ink-strong">
          One session, turn by turn. How much each turn added to the window.
        </h1>
        <p className="mt-2 text-[13px] leading-[1.6] text-studio-ink-faint">
          Step a playhead forward and backward across the turns and watch the context window fill.
          Each turn is a neutral marker — <b className="text-studio-ink">who spoke</b> and{" "}
          <b className="text-studio-ink">how much it added</b>. Scrub back to any earlier turn to see
          the window&apos;s composition as of that point. Real data from{" "}
          <code className="font-mono text-[11.5px] text-studio-ink">/api/session-analysis?demo=1</code>.
        </p>
      </header>
      <FillStage />
    </main>
  );
}

/* ================================================================== *
 * Stage — fetch, session selection, playhead state.
 * ================================================================== */
function FillStage() {
  const [sessions, setSessions] = useState<SessionModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // playhead is an index into the active session's turnOrder (a real turn).
  const [step, setStep] = useState(0);
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
        const corpus = payload.sessions
          .filter((s) => REAL_CORPUS_PREFIXES.some((p) => s.id.startsWith(p)))
          .filter((s) => s.atoms.length > 0)
          .map(buildSession)
          // most distinct turns first — that's the richest demo; ties by total tokens
          .sort((a, b) => b.distinctTurns - a.distinctTurns || b.totalTokens - a.totalTokens);
        if (!corpus.length) {
          setError("No real-corpus sessions (eve-relay--* / eve-binding--*) in the demo payload.");
          return;
        }
        setSessions(corpus);
        // default = richest turn-by-turn structure (first after the sort)
        setActiveId(corpus[0].id);
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
  const lastStep = active ? active.turnOrder.length - 1 : 0;
  const currentTurn = active ? active.turnOrder[Math.min(step, lastStep)] ?? active.firstTurn : 0;

  // reset playhead when switching sessions
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [activeId]);

  const move = useCallback(
    (dir: 1 | -1) => setStep((s) => Math.min(lastStep, Math.max(0, s + dir))),
    [lastStep],
  );

  useEffect(() => {
    if (!playing) return;
    if (step >= lastStep) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setStep((s) => Math.min(lastStep, s + 1)), 620);
    return () => window.clearTimeout(id);
  }, [playing, step, lastStep]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        move(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        move(-1);
      }
    },
    [move],
  );

  const scrubToTurn = useCallback(
    (turnIndex: number) => {
      if (!active) return;
      // snap to the nearest real turn at or below turnIndex, else the first
      let idx = 0;
      for (let i = 0; i < active.turnOrder.length; i++) {
        if (active.turnOrder[i] <= turnIndex) idx = i;
        else break;
      }
      setPlaying(false);
      setStep(idx);
    },
    [active],
  );

  if (error) {
    return (
      <div
        style={FILL_PALETTE}
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
        style={FILL_PALETTE}
        className="flex h-[560px] items-center justify-center rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] text-[var(--hg-muted)]"
      >
        <span className="inline-flex items-center gap-2 hg-mono text-[11px] uppercase tracking-[0.12em]">
          <Loader2 size={14} className="animate-spin" /> loading session…
        </span>
      </div>
    );
  }

  return (
    <div
      style={FILL_PALETTE}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col overflow-hidden rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] text-[var(--hg-ink)] shadow-2xl outline-none focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)]"
    >
      <SessionHeader model={active} turn={currentTurn} sessions={sessions} onPick={setActiveId} />
      <Transport
        stepNo={step + 1}
        stepCount={lastStep + 1}
        turn={currentTurn}
        playing={playing}
        onPlayToggle={() => setPlaying((p) => !p)}
        onStep={(d) => {
          setPlaying(false);
          move(d);
        }}
        onReset={() => {
          setPlaying(false);
          setStep(0);
        }}
      />
      <AccrualChart model={active} turn={currentTurn} onScrub={scrubToTurn} />
      <TurnSpine model={active} turn={currentTurn} onPick={(i) => { setPlaying(false); setStep(i); }} />
      <ImpactPanel model={active} turn={currentTurn} />
    </div>
  );
}

/* ================================================================== *
 * Header — title · harness · model · window now / total · turns + picker.
 * ================================================================== */
function SessionHeader({
  model,
  turn,
  sessions,
  onPick,
}: {
  model: SessionModel;
  turn: number;
  sessions: SessionModel[];
  onPick: (id: string) => void;
}) {
  const nowTotal = compositionAt(model, turn).total;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: sourceAccent(model.source) }}
        />
        <SessionPicker sessions={sessions} activeId={model.id} onPick={onPick} />
      </div>

      <Stat label="harness" value={sourceName(model.source)} />
      <Stat label="model" value={model.model} mono />
      <Stat
        label="window"
        value={
          <span>
            <span className="text-[var(--hg-ink)]">{formatAnalysisTokens(nowTotal)}</span>
            <span className="text-[var(--hg-muted)]"> / {formatAnalysisTokens(model.totalTokens)}</span>
          </span>
        }
      />
      <Stat label="turns" value={`${model.distinctTurns}`} mono />

      <div className="ml-auto flex items-center gap-4">
        {(["user", "assistant", "tool"] as RoleKind[]).map((k) => {
          const meta = ROLE_META[k];
          const Icon = meta.Icon;
          return (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 hg-mono text-[9px] uppercase tracking-[0.1em] text-[var(--hg-muted)]"
            >
              <Icon size={11} style={{ color: meta.hue }} />
              {meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col leading-none">
      <span className="hg-mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--hg-muted)]">
        {label}
      </span>
      <span
        className={"mt-1 text-[12px] text-[var(--hg-ink-2)] " + (mono ? "hg-mono tabular-nums" : "")}
      >
        {value}
      </span>
    </div>
  );
}

function SessionPicker({
  sessions,
  activeId,
  onPick,
}: {
  sessions: SessionModel[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <label className="relative flex items-center">
      <select
        value={activeId}
        onChange={(e) => onPick(e.target.value)}
        aria-label="session"
        className="max-w-[300px] cursor-pointer appearance-none truncate rounded-[4px] border border-[var(--hg-line)] bg-[var(--hg-surface)] py-1 pl-2.5 pr-7 text-[12px] font-medium text-[var(--hg-ink)] outline-none transition-colors hover:border-[var(--hg-hairline)] focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)]"
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} · {s.distinctTurns} turns
          </option>
        ))}
      </select>
      <ChevronRight
        size={13}
        className="pointer-events-none absolute right-2 rotate-90 text-[var(--hg-muted)]"
      />
    </label>
  );
}

/* ================================================================== *
 * Transport controls.
 * ================================================================== */
function Transport({
  stepNo,
  stepCount,
  turn,
  playing,
  onPlayToggle,
  onStep,
  onReset,
}: {
  stepNo: number;
  stepCount: number;
  turn: number;
  playing: boolean;
  onPlayToggle: () => void;
  onStep: (d: 1 | -1) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--hg-line)] bg-[var(--hg-surface)] px-4 py-2">
      <IconBtn label="restart" onClick={onReset} disabled={stepNo <= 1}>
        <SkipBack size={13} />
      </IconBtn>
      <IconBtn label="step back" onClick={() => onStep(-1)} disabled={stepNo <= 1}>
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
      <IconBtn label="step forward" onClick={() => onStep(1)} disabled={stepNo >= stepCount}>
        <ChevronRight size={15} />
      </IconBtn>

      <div className="ml-3 flex items-baseline gap-1.5">
        <span className="hg-mono text-[9px] uppercase tracking-[0.14em] text-[var(--hg-muted)]">
          turn
        </span>
        <span className="hg-mono text-[15px] font-semibold tabular-nums leading-none text-[var(--hg-ink)]">
          {String(turn).padStart(2, "0")}
        </span>
        <span className="hg-mono text-[11px] tabular-nums text-[var(--hg-muted)]">
          · {stepNo} of {stepCount}
        </span>
      </div>

      <span className="ml-auto hg-mono text-[9px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
        space play · ← → step · click a turn or the chart to scrub
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
 * Accumulation over time — stacked AREA (composition ≤ playhead).
 *
 * SVG. X = turnIndex (firstTurn..maxTurn), Y = cumulative window tokens,
 * stacked by bucket. Region ≤ playhead is solid/bright; future is faint.
 * Scrubbing back re-clips to that earlier turn. Click/drag scrubs.
 * ================================================================== */
const CHART_W = 1000;
const CHART_H = 260;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 6;

function AccrualChart({
  model,
  turn,
  onScrub,
}: {
  model: SessionModel;
  turn: number;
  onScrub: (t: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverTurn, setHoverTurn] = useState<number | null>(null);

  const { firstTurn, maxTurn } = model;
  const span = Math.max(1, maxTurn - firstTurn);
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;

  // stacked buckets in a stable draw order (biggest overall on the bottom)
  const stackOrder = useMemo(() => {
    const totals = new Map<ContextBucketId, number>();
    const last = model.cumByTurn.length ? model.cumByTurn[model.cumByTurn.length - 1] : new Map();
    for (const b of model.presentBuckets) totals.set(b, last.get(b) ?? 0);
    return [...model.presentBuckets].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
  }, [model]);

  // sample the accrual at every real turn (step function between turns)
  const samples = useMemo(() => {
    const out: { t: number; stack: Map<ContextBucketId, number>; total: number }[] = [];
    // start flat at the baseline before the first turn
    out.push({ t: firstTurn, stack: new Map(), total: 0 });
    model.turns.forEach((row, i) => {
      out.push({ t: row.turnIndex, stack: model.cumByTurn[i], total: model.cumTotalByTurn[i] });
    });
    return out;
  }, [model, firstTurn]);

  const yMax = Math.max(1, model.peakTotal);
  const xOf = (t: number) => PAD_L + ((t - firstTurn) / span) * plotW;
  const yOf = (v: number) => PAD_T + plotH - (v / yMax) * plotH;

  // one stacked <path> per bucket, as a step curve (accrual jumps at each turn)
  const bucketAreas = useMemo(() => {
    const areas: { bucket: ContextBucketId; color: string; d: string }[] = [];
    const baseline = samples.map(() => 0);
    for (const bucket of [...stackOrder].reverse()) {
      const meta = bucketMeta(bucket);
      const tops = samples.map((s, i) => baseline[i] + (s.stack.get(bucket) ?? 0));
      let d = "";
      // upper edge, L→R, as a step (hold value then jump)
      samples.forEach((s, i) => {
        const x = xOf(s.t);
        if (i === 0) d += `M ${x.toFixed(2)} ${yOf(tops[i]).toFixed(2)} `;
        else {
          // horizontal to this x at the previous top, then vertical jump
          d += `L ${x.toFixed(2)} ${yOf(tops[i - 1]).toFixed(2)} `;
          d += `L ${x.toFixed(2)} ${yOf(tops[i]).toFixed(2)} `;
        }
      });
      // lower edge (baseline) R→L, also stepped
      for (let i = samples.length - 1; i >= 0; i--) {
        const x = xOf(samples[i].t);
        d += `L ${x.toFixed(2)} ${yOf(baseline[i]).toFixed(2)} `;
        if (i > 0) d += `L ${xOf(samples[i - 1].t).toFixed(2)} ${yOf(baseline[i]).toFixed(2)} `;
      }
      d += "Z";
      areas.push({ bucket, color: meta.color, d });
      samples.forEach((_, i) => (baseline[i] = tops[i]));
    }
    return areas.reverse();
  }, [samples, stackOrder, span, yMax, firstTurn]);

  const playX = xOf(turn);
  const clipId = `impact-past-${model.id.replace(/[^a-z0-9]/gi, "")}`;

  /* pointer → nearest real turnIndex */
  const turnFromClientX = useCallback(
    (clientX: number): number => {
      const el = svgRef.current;
      if (!el) return turn;
      const rect = el.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * CHART_W;
      const frac = Math.min(1, Math.max(0, (px - PAD_L) / plotW));
      return firstTurn + Math.round(frac * span);
    },
    [span, plotW, turn, firstTurn],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      setDragging(true);
      onScrub(turnFromClientX(e.clientX));
    },
    [onScrub, turnFromClientX],
  );
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      setHoverTurn(turnFromClientX(e.clientX));
      if (dragging) onScrub(turnFromClientX(e.clientX));
    },
    [dragging, onScrub, turnFromClientX],
  );
  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    setDragging(false);
  }, []);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepV = niceStep(yMax / 4);
    for (let v = 0; v <= yMax; v += stepV) ticks.push(v);
    return ticks;
  }, [yMax]);

  return (
    <section className="border-b border-[var(--hg-hairline)] bg-[var(--hg-bg)]">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="hg-section-label">accumulation · cumulative window tokens by turn</span>
        <BucketLegend buckets={model.presentBuckets} />
      </div>

      <div className="relative px-4 pb-3 pt-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="none"
          className="h-[260px] w-full cursor-ew-resize touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHoverTurn(null)}
          role="slider"
          aria-label="playhead"
          aria-valuemin={firstTurn}
          aria-valuemax={maxTurn}
          aria-valuenow={turn}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD_L} y={0} width={Math.max(0, playX - PAD_L)} height={CHART_H} />
            </clipPath>
          </defs>

          {/* y gridlines */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD_L}
                x2={CHART_W - PAD_R}
                y1={yOf(v)}
                y2={yOf(v)}
                stroke="var(--hg-line)"
                strokeWidth={0.75}
              />
              <text
                x={PAD_L + 2}
                y={yOf(v) - 3}
                fill="var(--hg-muted)"
                fontSize={9}
                fontFamily="var(--hg-mono)"
              >
                {v === 0 ? "" : formatAnalysisTokens(v)}
              </text>
            </g>
          ))}

          {/* FUTURE (faint) — full stack drawn dim underneath */}
          <g opacity={0.16}>
            {bucketAreas.map((a) => (
              <path key={`f-${a.bucket}`} d={a.d} fill={a.color} />
            ))}
          </g>

          {/* PAST (bright) — same stack clipped to ≤ playhead */}
          <g clipPath={`url(#${clipId})`}>
            {bucketAreas.map((a) => (
              <path key={`p-${a.bucket}`} d={a.d} fill={a.color} />
            ))}
          </g>

          {/* top outline of the accrued total */}
          <path
            d={outlinePath(samples, xOf, yOf)}
            fill="none"
            stroke="var(--hg-ink)"
            strokeOpacity={0.35}
            strokeWidth={1}
          />

          {/* hover marker */}
          {hoverTurn !== null && hoverTurn !== turn && (
            <line
              x1={xOf(hoverTurn)}
              x2={xOf(hoverTurn)}
              y1={PAD_T}
              y2={CHART_H - PAD_B}
              stroke="var(--hg-hairline)"
              strokeWidth={0.75}
              strokeDasharray="2 3"
            />
          )}

          {/* PLAYHEAD */}
          <line
            x1={playX}
            x2={playX}
            y1={PAD_T - 6}
            y2={CHART_H - PAD_B}
            stroke="var(--hg-accent)"
            strokeWidth={1.5}
          />
          <rect
            x={playX - 4}
            y={PAD_T - 10}
            width={8}
            height={8}
            rx={1.5}
            fill="var(--hg-accent)"
            transform={`rotate(45 ${playX} ${PAD_T - 6})`}
          />
        </svg>

        {/* x-axis turn labels */}
        <div className="relative mt-0.5 h-3">
          {axisTurns(firstTurn, maxTurn).map((t) => (
            <span
              key={t}
              className="absolute hg-mono text-[8.5px] tabular-nums text-[var(--hg-muted)]"
              style={{ left: `${(xOf(t) / CHART_W) * 100}%`, transform: "translateX(-50%)" }}
            >
              t{t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Stepped top outline of the cumulative total. */
function outlinePath(
  samples: { t: number; total: number }[],
  xOf: (t: number) => number,
  yOf: (v: number) => number,
): string {
  let d = "";
  samples.forEach((s, i) => {
    const x = xOf(s.t);
    if (i === 0) d += `M ${x.toFixed(2)} ${yOf(s.total).toFixed(2)} `;
    else {
      d += `L ${x.toFixed(2)} ${yOf(samples[i - 1].total).toFixed(2)} `;
      d += `L ${x.toFixed(2)} ${yOf(s.total).toFixed(2)} `;
    }
  });
  return d;
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return nice * mag;
}

function axisTurns(firstTurn: number, maxTurn: number): number[] {
  const span = maxTurn - firstTurn;
  if (span <= 0) return [firstTurn];
  const step = Math.max(1, Math.round(span / 8));
  const out: number[] = [];
  for (let t = firstTurn; t <= maxTurn; t += step) out.push(t);
  if (out[out.length - 1] !== maxTurn) out.push(maxTurn);
  return out;
}

/* ================================================================== *
 * Turn spine — the primary navigable axis.
 *
 * One marker per real turn, laid left→right. Marker height ∝ tokens that
 * turn ADDED to the window (per-turn delta). Role sets a neutral hue/glyph.
 * Click a marker to move the playhead. Current turn is clearly highlighted.
 * ================================================================== */
function TurnSpine({
  model,
  turn,
  onPick,
}: {
  model: SessionModel;
  turn: number;
  onPick: (stepIndex: number) => void;
}) {
  const yMax = Math.max(1, model.peakDelta);
  return (
    <section className="border-b border-[var(--hg-line)] bg-[var(--hg-surface)] px-4 pt-3 pb-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="hg-section-label">turn spine · tokens added per turn</span>
        <span className="hg-mono text-[8.5px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">
          peak +{formatAnalysisTokens(model.peakDelta)} · height ∝ tokens added
        </span>
      </div>

      <div className="flex items-end gap-[3px] overflow-x-auto pb-1">
        {model.turns.map((row, i) => {
          const meta = ROLE_META[row.role];
          const isCurrent = row.turnIndex === turn;
          const isPast = row.turnIndex <= turn;
          const h = 8 + Math.round((row.delta / yMax) * 68); // 8..76px
          const Icon = meta.Icon;
          return (
            <button
              key={row.turnIndex}
              type="button"
              onClick={() => onPick(i)}
              title={`turn ${row.turnIndex} · ${meta.label} · +${formatAnalysisTokens(row.delta)}`}
              aria-label={`turn ${row.turnIndex}, ${meta.label}, added ${formatAnalysisTokens(row.delta)} tokens`}
              aria-current={isCurrent}
              className={
                "group relative flex shrink-0 flex-col items-center justify-end rounded-[2px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)]"
              }
              style={{ width: 14 }}
            >
              <Icon
                size={9}
                className="mb-[3px] transition-opacity"
                style={{
                  color: isCurrent ? "var(--hg-accent)" : meta.hue,
                  opacity: isPast ? 0.9 : 0.4,
                }}
              />
              <span
                className="w-full rounded-[2px] transition-all"
                style={{
                  height: h,
                  background: isCurrent ? "var(--hg-accent)" : meta.hue,
                  opacity: isCurrent ? 1 : isPast ? 0.62 : 0.24,
                }}
              />
              <span
                className={
                  "mt-1 hg-mono text-[7.5px] tabular-nums " +
                  (isCurrent ? "text-[var(--hg-accent)]" : "text-[var(--hg-muted)]")
                }
              >
                {row.turnIndex}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* Compact bucket legend for the buckets present in this session. */
function BucketLegend({ buckets }: { buckets: ContextBucketId[] }) {
  const ordered = CONTEXT_BUCKETS.filter((b) => buckets.includes(b.id));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {ordered.map((b) => (
        <span
          key={b.id}
          className="inline-flex items-center gap-1 hg-mono text-[8.5px] uppercase tracking-[0.06em] text-[var(--hg-muted)]"
        >
          <span className="h-1.5 w-1.5 rounded-[1px]" style={{ background: b.color }} />
          {b.label}
        </span>
      ))}
    </div>
  );
}

/* ================================================================== *
 * Impact panel — the impact of the CURRENT turn + the window as of now.
 *   left  : this turn's delta + composition delta by bucket (what grew).
 *   right : window composition as of the playhead (running stacked bar).
 * All labels neutral. No scoring.
 * ================================================================== */
function ImpactPanel({ model, turn }: { model: SessionModel; turn: number }) {
  const thisTurn = model.turnByIndex.get(turn) ?? null;
  const { comp, total } = compositionAt(model, turn);

  const deltaRows = useMemo(() => {
    if (!thisTurn) return [];
    return CONTEXT_BUCKETS.map((b) => ({
      bucket: b.id,
      label: b.label,
      color: b.color,
      tokens: thisTurn.bucketDelta.get(b.id) ?? 0,
    }))
      .filter((x) => x.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens);
  }, [thisTurn]);

  const compRows = useMemo(
    () =>
      CONTEXT_BUCKETS.map((b) => ({
        bucket: b.id,
        label: b.label,
        color: b.color,
        tokens: comp.get(b.id) ?? 0,
      })).filter((x) => x.tokens > 0),
    [comp],
  );

  const roleMeta = thisTurn ? ROLE_META[thisTurn.role] : null;
  const RoleIcon = roleMeta?.Icon;

  return (
    <section className="grid gap-px bg-[var(--hg-line)] md:grid-cols-[1.15fr_1fr]">
      {/* IMPACT OF THIS TURN */}
      <div className="bg-[var(--hg-surface-2)] px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="hg-section-label">impact of turn {turn}</span>
          {thisTurn && (
            <span className="hg-mono text-[13px] font-semibold tabular-nums text-[var(--hg-ink)]">
              +{formatAnalysisTokens(thisTurn.delta)}
            </span>
          )}
        </div>

        {!thisTurn ? (
          <div className="flex min-h-[120px] items-center justify-center hg-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">
            no atoms at this turn
          </div>
        ) : (
          <>
            {/* role marker + neutral gist */}
            <div className="mb-3 flex items-center gap-2">
              {RoleIcon && roleMeta && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-0.5 hg-mono text-[9px] uppercase tracking-[0.08em]"
                  style={{ background: `${roleMeta.hue}22`, color: roleMeta.hue }}
                >
                  <RoleIcon size={11} />
                  {roleMeta.label}
                </span>
              )}
              <span
                className="truncate hg-mono text-[10px] lowercase text-[var(--hg-muted)]"
                title={turnGist(thisTurn)}
              >
                {turnGist(thisTurn)}
              </span>
            </div>

            {/* composition delta by bucket — which buckets grew, by how much */}
            <div className="mb-1.5 hg-mono text-[8.5px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
              added to these buckets
            </div>
            <div className="flex flex-col gap-1.5">
              {deltaRows.map((seg) => (
                <div key={seg.bucket} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ background: seg.color }}
                  />
                  <span className="hg-mono text-[10.5px] lowercase text-[var(--hg-ink-2)]">
                    {seg.label}
                  </span>
                  {/* proportional delta bar within the turn */}
                  <span className="mx-1 h-1.5 flex-1 overflow-hidden rounded-[1px] bg-[var(--hg-bg)]">
                    <span
                      className="block h-full rounded-[1px]"
                      style={{
                        width: `${thisTurn.delta ? (seg.tokens / thisTurn.delta) * 100 : 0}%`,
                        background: seg.color,
                        opacity: 0.85,
                      }}
                    />
                  </span>
                  <span className="shrink-0 hg-mono text-[10px] tabular-nums text-[var(--hg-ink-2)]">
                    +{formatAnalysisTokens(seg.tokens)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* WINDOW AS OF THIS TURN */}
      <div className="bg-[var(--hg-surface-2)] px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="hg-section-label">window as of turn {turn}</span>
          <span className="hg-mono text-[13px] font-semibold tabular-nums text-[var(--hg-ink)]">
            {formatAnalysisTokens(total)}
          </span>
        </div>

        {/* running composition stacked bar (cumulative bucket tokens ≤ playhead) */}
        <div className="flex h-3 w-full overflow-hidden rounded-[2px] bg-[var(--hg-bg)]">
          {compRows.map((seg) => (
            <span
              key={seg.bucket}
              title={`${seg.label} · ${formatAnalysisTokens(seg.tokens)}`}
              style={{ flexGrow: seg.tokens, flexBasis: 0, background: seg.color }}
            />
          ))}
          {total === 0 && <span className="flex-1" />}
        </div>

        <div className="mt-2.5 flex flex-col gap-1">
          {compRows.map((seg) => (
            <div key={seg.bucket} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: seg.color }} />
              <span className="hg-mono text-[10px] lowercase text-[var(--hg-ink-2)]">{seg.label}</span>
              <span className="ml-auto hg-mono text-[10px] tabular-nums text-[var(--hg-muted)]">
                {formatAnalysisTokens(seg.tokens)}
              </span>
              <span className="w-9 text-right hg-mono text-[9px] tabular-nums text-[var(--hg-muted)]">
                {total ? Math.round((seg.tokens / total) * 100) : 0}%
              </span>
            </div>
          ))}
          {total === 0 && (
            <div className="hg-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">
              nothing accrued yet
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
