"use client";

// Single session — turns × accumulation (studio prototype).
//
// A MERGE of two earlier studies into one coherent instrument, in one visual
// language (lifted from the former SessionFillPrototype: palette, type, spacing,
// stat-bar). This is a REPORTING instrument. It reports impact; it never
// editorializes. A turn is never rated. There is no "noise", no "signal", no
// "waste" — only who spoke, what they did (a neutral gist), and how much it
// ADDED to the window.
//
// A LEFT SESSION LIST + THREE ZONES, one shared cursor (= the current turn's
// row index). All four regions read the SAME cursor, which is now driven by a
// TRANSPORT (play / pause / prev / next) as well as by scroll and clicks:
//   0. LEFT SESSION LIST — a vertical column of sessions (title · harness/model ·
//      turn-count badge). Picking a session switches the instrument. This is the
//      ONLY place session selection lives — the old header dropdown is gone.
//   1. FIXED HEADER — never scrolls. The stat-bar DISPLAYS the current session
//      (harness · model · window x/cap · turns) plus the TRANSPORT cluster
//      (⏮ prev · ▶/⏸ play/pause · ⏭ next · turn N/T). Directly below it, the
//      compact ACCUMULATION mountain (cumulative window tokens by turn, stacked
//      by bucket, with a vertical playhead ◆ and the bucket legend).
//   2. SCROLLABLE TIMELINE — the ONLY thing that scrolls. A vertical
//      conversation log, one row per turnIndex, top→bottom: role bead, gist,
//      per-turn +N delta, bucket chips. Scrolling drives the playhead; clicking
//      a row (or the mountain) seeks; PLAY auto-advances the cursor one turn at
//      a time (~700ms) toward the end and keeps the active row in view.
//   3. RIGHT COLUMN — "Impact of turn N". Tracks the cursor turn continuously.
//      Shows the turn's role · gist, its +N delta, per-bucket deltas, then the
//      WINDOW AS OF TURN N (running composition ≤ cursor). Collapses on narrower
//      viewports; the timeline then goes full width and the active row expands
//      its own impact inline.
//
// RESPONSIVE — keyed off the VIEWPORT (not the shrunk inner container, which the
// left rail eats into):
//   • ≥ 1440px : left list + timeline + right impact column, all together.
//   • 1000–1440: left list + timeline; right impact collapses (inline impact).
//   • < 1000px : left list collapses to a compact selector; timeline stays wide.
//
// STUDIO prototype: self-contained. Fetches REAL data client-side from
// GET /api/session-analysis?demo=1 and auto-selects the session with the MOST
// distinct turnIndex values. Reuses the real bucket palette (CONTEXT_BUCKETS /
// bucketMeta). Does NOT touch server code or feature components.

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
  Bot,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  User,
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
interface ObserveSession {
  id: string;
  title: string;
  source: string;
  model?: string | null;
  modelWindow?: number | null;
  atoms: ContextAtom[];
}
interface SessionAnalysisPayload {
  sessions: ObserveSession[];
}

/** Which sessions form the real capture corpus. */
const REAL_CORPUS_PREFIXES = ["eve-relay--", "eve-binding--"];

/* Per-harness accent (chrome only — the plot stays bucket-colored). */
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
 * Gist condensation — compact TS, neutral & descriptive. All output
 * reads `read · binding.mjs`, `shell · npm test`. Never verbatim prose.
 *
 * Two polish passes on top of the base gist:
 *   • strip sandbox path prefixes (e.g. /private/tmp/eve-relay-grok/…) so the
 *     timeline never carries /private/tmp noise;
 *   • collapse near-identical consecutive commands (repeated
 *     `git status && git diff --stat` → a short `git diff` verb) — applied at
 *     the session level once rows are built.
 * ================================================================== */

/** Sandbox / scratch path prefixes that add noise, not orientation. */
const SANDBOX_PREFIXES = [
  "/private/tmp/eve-relay-grok",
  "/private/tmp/eve-relay",
  "/private/tmp/eve-binding",
  "/private/tmp",
  "/private/var/folders",
  "/var/folders",
  "/tmp",
];

/** Drop a leading sandbox path prefix wherever it appears in a string. */
function stripSandboxPaths(value: string): string {
  let out = value;
  for (const prefix of SANDBOX_PREFIXES) {
    // remove the prefix but keep a meaningful trailing segment
    const re = new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/?", "g");
    out = out.replace(re, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** First non-empty trimmed string among the candidates. */
function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

/** First N chars of the first meaningful line. */
function truncatePreview(value: string, maxChars = 80): string {
  const line = value
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return "";
  return line.length <= maxChars ? line : `${line.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Drop a leading `cd <dir> &&` (scratch-dir hop) so the real command leads. */
function dropLeadingCd(command: string): string {
  return command.replace(/^\s*cd\b[^&|;]*(?:&&|;)\s*/i, "").trim();
}

/** Pick the argument that best names a tool call, sandbox-stripped. */
function toolArgSummary(command: string | null): string {
  const raw = firstString(command);
  if (!raw) return "";
  const cleaned = dropLeadingCd(stripSandboxPaths(raw));
  if (!cleaned) return "";
  // A bare path (no spaces) → show its basename; otherwise a trimmed preview.
  if (/[\\/]/.test(cleaned) && !cleaned.includes(" ")) return basename(cleaned);
  return truncatePreview(cleaned, 64);
}

/** Normalize a harness tool name to a small stable vocabulary. */
function normalizeToolName(toolName: string): string {
  switch (toolName.trim().toLowerCase()) {
    case "read":
    case "view":
      return "read";
    case "grep":
    case "glob":
    case "search":
      return "grep";
    case "edit":
    case "multiedit":
      return "edit";
    case "write":
      return "write";
    case "bash":
    case "shell":
      return "shell";
    case "agent":
      return "agent";
    default:
      return toolName.trim().toLowerCase() || "tool";
  }
}

function basename(path: string): string {
  const clean = path.split("?")[0].split("#")[0].replace(/\/+$/, "");
  const seg = clean.split("/").filter(Boolean);
  return seg[seg.length - 1] ?? clean;
}

/**
 * A shorter descriptor for a shell/command atom — the first invoked binary +
 * a hint, used to detect near-identical consecutive commands. Sandbox-stripped.
 * `git status && git diff --stat` → `git diff` (the last meaningful verb).
 */
function commandSignature(command: string | null): string | null {
  const raw = firstString(command);
  if (!raw) return null;
  const cleaned = dropLeadingCd(stripSandboxPaths(raw));
  if (!cleaned) return null;
  // If the command carries a quoted payload (e.g. `node -e "…"`, `sh -c "…"`),
  // ignore everything inside the quotes — the signature is the leading binary.
  const beforeQuote = cleaned.split(/["'`]/u)[0].trim();
  const head = beforeQuote || cleaned;
  // Otherwise split a chained shell line and take the last meaningful segment.
  const segments = head
    .split(/&&|\|\||;|\|/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const last = segments[segments.length - 1] ?? head;
  const tokens = last.split(/\s+/u).filter((t) => /[A-Za-z]/.test(t));
  if (!tokens.length) return null;
  // `git diff --stat` → `git diff`; `npm test` → `npm test`; `ls -la` → `ls`
  if (tokens.length >= 2 && /^(git|npm|bun|pnpm|yarn|cargo|go|docker)$/.test(tokens[0])) {
    return `${tokens[0]} ${tokens[1]}`.replace(/[^\w\s.-]+$/, "");
  }
  return tokens[0];
}

/* ================================================================== *
 * Role — neutral speaker family. No evaluation; purely descriptive.
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
  if (atom.sourceType === "reasoning" || atom.sourceType === "message") return "assistant";
  return "assistant";
}

/**
 * A short, neutral gist for the turn — the chat-row headline. Tool turns read
 * `read · binding.mjs`; message/reasoning turns read their neutral label. The
 * `collapsedVerb` (set during the session build for repeated commands) wins
 * when present, so a run of git status/diff turns reads a single tightened verb.
 */
function turnGist(row: TurnRow): string {
  if (row.collapsedVerb) return row.collapsedVerb;
  const lead = row.atoms[0];
  if (!lead) return "";
  if (lead.toolName) {
    const verb = normalizeToolName(lead.toolName);
    const arg = toolArgSummary(lead.command);
    return arg ? `${verb} · ${arg}` : verb;
  }
  const label = stripSandboxPaths((lead.label ?? "").trim());
  if (label) return label;
  return bucketMeta(lead.bucket).label;
}

/** A muted second-line orientation gist — the next distinct descriptor, if any. */
function turnSubGist(row: TurnRow): string {
  if (row.collapsedVerb) return "";
  const lead = row.atoms[0];
  const second = row.atoms.find((a) => a !== lead);
  if (!second) return "";
  if (second.toolName) {
    const verb = normalizeToolName(second.toolName);
    const arg = toolArgSummary(second.command);
    return arg ? `${verb} · ${arg}` : verb;
  }
  const label = stripSandboxPaths((second.label ?? "").trim());
  return label && label !== turnGist(row) ? label : "";
}

/* ------------------------------------------------------------------ *
 * Session model — group atoms by turnIndex, precompute cumulative accrual.
 * ------------------------------------------------------------------ */
interface TurnRow {
  turnIndex: number;
  role: RoleKind;
  atoms: ContextAtom[];
  delta: number;
  bucketDelta: Map<ContextBucketId, number>;
  pinned: boolean;
  /** Set when this row collapses a run of near-identical commands (`ran · git diff`). */
  collapsedVerb: string | null;
}
interface SessionModel {
  id: string;
  source: string;
  model: string;
  title: string;
  turns: TurnRow[];
  turnOrder: number[]; // sorted turnIndex values carrying atoms
  indexByTurn: Map<number, number>; // turnIndex → row position
  firstTurn: number;
  maxTurn: number;
  totalTokens: number;
  presentBuckets: ContextBucketId[];
  cumByTurn: Map<ContextBucketId, number>[];
  cumTotalByTurn: number[];
  peakTotal: number;
  distinctTurns: number;
}

function humanModel(s: ObserveSession): string {
  if (s.model) return s.model;
  const tail = s.id.split("--")[1] ?? s.source;
  return tail.replace(new RegExp(`^${s.source}-?`), "").replace(/-/g, " ") || s.source;
}

function buildSession(s: ObserveSession): SessionModel {
  const byIndex = new Map<number, TurnRow>();
  for (const atom of s.atoms) {
    const t = atom.turnIndex ?? 0;
    let row = byIndex.get(t);
    if (!row) {
      row = {
        turnIndex: t,
        role: "assistant",
        atoms: [],
        delta: 0,
        bucketDelta: new Map(),
        pinned: false,
        collapsedVerb: null,
      };
      byIndex.set(t, row);
    }
    row.atoms.push(atom);
    row.delta += atom.tokens;
    row.pinned = row.pinned || Boolean(atom.pinned);
    row.bucketDelta.set(atom.bucket, (row.bucketDelta.get(atom.bucket) ?? 0) + atom.tokens);
  }

  const turns = [...byIndex.values()].sort((a, b) => a.turnIndex - b.turnIndex);
  for (const t of turns) {
    t.atoms.sort((a, b) => b.tokens - a.tokens); // biggest first → gist reads top-down
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

  // Collapse near-identical consecutive commands. When a run of tool turns share
  // the same command signature (e.g. repeated `git status && git diff --stat`),
  // all but the first read `ran · <verb>` so the timeline stops repeating noise.
  for (let i = 0; i < turns.length; i++) {
    const row = turns[i];
    const lead = row.atoms[0];
    if (row.role !== "tool" || !lead?.command) continue;
    const sig = commandSignature(lead.command);
    if (!sig) continue;
    const prev = turns[i - 1];
    const prevLead = prev?.atoms[0];
    const prevSig = prev?.role === "tool" && prevLead?.command ? commandSignature(prevLead.command) : null;
    if (prevSig && prevSig === sig) {
      row.collapsedVerb = `ran · ${sig}`;
    }
  }

  const turnOrder = turns.map((t) => t.turnIndex);
  const indexByTurn = new Map(turnOrder.map((t, i) => [t, i]));
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

  return {
    id: s.id,
    source: s.source,
    model: humanModel(s),
    title: s.title,
    turns,
    turnOrder,
    indexByTurn,
    firstTurn,
    maxTurn,
    totalTokens,
    presentBuckets,
    cumByTurn,
    cumTotalByTurn,
    peakTotal,
    distinctTurns: turnOrder.length,
  };
}

/** Composition at (or before) a given row index. */
function compositionAt(
  model: SessionModel,
  rowIdx: number,
): { comp: Map<ContextBucketId, number>; total: number } {
  if (rowIdx < 0 || !model.cumByTurn.length) return { comp: new Map(), total: 0 };
  const i = Math.min(rowIdx, model.cumByTurn.length - 1);
  return { comp: model.cumByTurn[i], total: model.cumTotalByTurn[i] };
}

/* ------------------------------------------------------------------ *
 * Local palette — scoped to the prototype container (matches siblings).
 * ------------------------------------------------------------------ */
const OBSERVE_PALETTE = {
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

/* ------------------------------------------------------------------ *
 * Responsive tier — keyed off the VIEWPORT (not the inner container, which the
 * left rail shrinks). Driven by matchMedia so it is a true viewport query and
 * side-steps a Tailwind-cascade quirk in this build where a responsive `flex`
 * cannot re-show a base `hidden`. Tiers:
 *   • "wide" ≥ 1440px : left list + timeline + right impact column together.
 *   • "mid"  1000–1440: left list + timeline; right impact collapses inline.
 *   • "narrow" < 1000 : left list collapses to a compact selector.
 * SSR-safe: renders "wide" on the server / first paint, then corrects on mount.
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
  const [sessions, setSessions] = useState<SessionModel[] | null>(null);
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
          .map(buildSession)
          // most distinct turns first — richest conversation; ties by total tokens
          .sort((a, b) => b.distinctTurns - a.distinctTurns || b.totalTokens - a.totalTokens);
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
 * Workspace — joins the LEFT session list to the instrument, laid out off the
 * viewport tier. narrow → stacked (compact selector above the tool); mid/wide →
 * side-by-side (full list column beside the tool).
 * ================================================================== */
function ObserveWorkspace({
  active,
  sessions,
  onPick,
}: {
  active: SessionModel;
  sessions: SessionModel[];
  onPick: (id: string) => void;
}) {
  const tier = useViewportTier();
  const stacked = tier === "narrow";

  return (
    <div
      style={OBSERVE_PALETTE}
      className={
        "flex items-stretch " + (stacked ? "flex-col gap-3" : "flex-row gap-4")
      }
    >
      {/* LEFT SESSION LIST — full column ≥ 1000px; a compact selector below. */}
      <SessionList sessions={sessions} activeId={active.id} onPick={onPick} tier={tier} />
      <div className="min-w-0 flex-1">
        <ObserveInstrument key={active.id} model={active} tier={tier} />
      </div>
    </div>
  );
}

/* ================================================================== *
 * ZONE 0 — Session list (LEFT). Replaces the old header dropdown. A vertical
 * column of sessions: title, `harness · model`, turn-count badge; the active
 * one carries an accent left-border + tint. Picking one switches the
 * instrument (which resets the cursor to the first turn via its `key`). At full
 * width it is a ~210px scroll column; below 1000px it collapses to a compact
 * dropdown so the timeline keeps the room.
 * ================================================================== */
function SessionList({
  sessions,
  activeId,
  onPick,
  tier,
}: {
  sessions: SessionModel[];
  activeId: string;
  onPick: (id: string) => void;
  tier: ViewportTier;
}) {
  // narrow → a compact dropdown so the timeline keeps the room;
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
                      {sourceName(s.source)} · {s.model}
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
                    {s.distinctTurns}
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
  sessions: SessionModel[];
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
              {s.title} · {sourceName(s.source)} · {s.distinctTurns} turns
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

/* ================================================================== *
 * Instrument — owns the cursor state machine and the scroll↔playhead wiring.
 *
 * cursor  = the current row index (0..turns.length-1).
 * playing = when on, an interval auto-advances the cursor toward the last turn.
 *
 * THREE update paths meet on `cursor`, so we guard against a feedback loop:
 *   • user scroll → IntersectionObserver picks the top visible row → setCursor
 *   • click a peak / row, or prev/next → programmatic smooth scroll → setCursor
 *   • play tick → programmatic smooth scroll to cursor+1 → setCursor
 * A `programmaticRef` latch suppresses observer-driven updates while any
 * programmatic (click- or play-driven) scroll animates, so they never fight.
 *
 * LAYOUT: the stat-bar + mountain are FIXED (they live above the scroll
 * container, so they never move). The scroll container holds ONLY the
 * conversation log. The impact column sits to the right and collapses below
 * ~1440px of VIEWPORT (not container width — the left rail shrinks the
 * container), at which point the active row expands its impact inline.
 *
 * TRANSPORT: `playing` drives an interval that advances the cursor one turn
 * every PLAY_INTERVAL_MS toward the end, stopping at the last turn. It reuses
 * `scrollToRow` — so the programmatic-scroll guard already prevents the
 * IntersectionObserver from fighting the auto-scroll during playback.
 * ================================================================== */
const PLAY_INTERVAL_MS = 700;

function ObserveInstrument({ model, tier }: { model: SessionModel; tier: ViewportTier }) {
  const lastRow = model.turns.length - 1;
  const showImpactColumn = tier === "wide"; // right column only ≥ 1440px viewport
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  // suppress observer updates while a programmatic (click-driven) scroll runs.
  const programmaticRef = useRef(false);
  const programmaticTimer = useRef<number | null>(null);
  // latest cursor, read inside the play interval without re-arming it each tick.
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  const clampRow = useCallback((i: number) => Math.max(0, Math.min(lastRow, i)), [lastRow]);

  /** Smooth-scroll the log to a row and set the cursor. Latches the guard. */
  const scrollToRow = useCallback(
    (rowIdx: number, behavior: ScrollBehavior = "smooth") => {
      const idx = clampRow(rowIdx);
      setCursor(idx);
      const el = rowRefs.current[idx];
      const container = scrollRef.current;
      if (!el || !container) return;
      programmaticRef.current = true;
      if (programmaticTimer.current) window.clearTimeout(programmaticTimer.current);
      programmaticTimer.current = window.setTimeout(
        () => {
          programmaticRef.current = false;
        },
        behavior === "smooth" ? 520 : 60,
      );
      const top = el.offsetTop - container.clientHeight * 0.28;
      container.scrollTo({ top: Math.max(0, top), behavior });
    },
    [clampRow],
  );

  /* IntersectionObserver: the topmost row inside a focus band becomes the
     cursor. This is the scroll→playhead half of the linkage. */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const visible = new Map<number, number>(); // rowIdx → intersectionRatio

    const observer = new IntersectionObserver(
      (entries) => {
        if (programmaticRef.current) return; // don't fight a click-driven scroll
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.rowIdx);
          if (Number.isNaN(idx)) continue;
          if (entry.isIntersecting) visible.set(idx, entry.intersectionRatio);
          else visible.delete(idx);
        }
        if (!visible.size) return;
        // active turn = the smallest row index still in view (reading order).
        const active = Math.min(...visible.keys());
        setCursor((prev) => (prev === active ? prev : active));
      },
      {
        root: container,
        // focus band near the top of the scroll viewport.
        rootMargin: "0px 0px -68% 0px",
        threshold: [0, 0.5, 1],
      },
    );

    for (const el of rowRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [model.id]);

  /* Stepping — used by prev/next, the mountain scrub, and row clicks. Stepping
     backwards (or landing before the end) never auto-starts playback; the play
     interval is the only thing that keeps advancing. */
  const seekToRow = useCallback(
    (rowIdx: number) => {
      scrollToRow(rowIdx);
    },
    [scrollToRow],
  );

  const stepPrev = useCallback(() => {
    setPlaying(false);
    scrollToRow(cursorRef.current - 1);
  }, [scrollToRow]);

  const stepNext = useCallback(() => {
    setPlaying(false);
    scrollToRow(cursorRef.current + 1);
  }, [scrollToRow]);

  const togglePlay = useCallback(() => {
    // At the live edge, PLAY restarts from the top so there's always something
    // to watch; otherwise it resumes forward from the current cursor.
    setPlaying((p) => {
      if (p) return false;
      if (cursorRef.current >= lastRow) scrollToRow(0, "auto");
      return true;
    });
  }, [lastRow, scrollToRow]);

  /* PLAY DRIVER — one interval, armed only while `playing`. Each tick advances
     the cursor one turn via scrollToRow (which latches the programmatic guard,
     so the IntersectionObserver stays quiet during auto-scroll). Reaching the
     last turn stops playback and flips the button back to ▶. */
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = cursorRef.current + 1;
      if (next > lastRow) {
        setPlaying(false);
        return;
      }
      scrollToRow(next, "smooth");
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing, lastRow, scrollToRow]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepPrev();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    },
    [stepNext, stepPrev, togglePlay],
  );

  const currentTurn = model.turnOrder[cursor] ?? model.firstTurn;

  return (
    <div
      style={OBSERVE_PALETTE}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col overflow-hidden rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] text-[var(--hg-ink)] shadow-2xl outline-none focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)]"
    >
      {/* ZONE 1 — FIXED HEADER. Stat-bar (display-only) + transport + mountain. */}
      <SessionHeader
        model={model}
        cursor={cursor}
        playing={playing}
        onPrev={stepPrev}
        onNext={stepNext}
        onTogglePlay={togglePlay}
      />
      <div className="border-b border-[var(--hg-hairline)] bg-[var(--hg-bg)]">
        <AccumulationBand model={model} cursor={cursor} onScrubToRow={seekToRow} />
      </div>

      {/* ZONES 2 + 3 — scrollable timeline | responsive impact column.
          Gated by the VIEWPORT tier (not container width — the left rail shrinks
          the container). Only the "wide" tier (≥ 1440px) mounts the right impact
          column; below that the timeline goes full width and the active row
          surfaces its impact inline. */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: showImpactColumn ? "minmax(0,1fr) 360px" : "minmax(0,1fr)",
        }}
      >
        {/* ZONE 2 — SCROLLABLE TIMELINE (the only thing that scrolls). */}
        <div
          ref={scrollRef}
          className={
            "relative max-h-[560px] min-h-[460px] overflow-y-auto overflow-x-hidden overscroll-contain border-[var(--hg-line)] " +
            (showImpactColumn ? "border-r" : "")
          }
        >
          <ConversationLog
            model={model}
            cursor={cursor}
            showInlineImpact={!showImpactColumn}
            onSeekRow={seekToRow}
            registerRow={(i, el) => {
              rowRefs.current[i] = el;
            }}
          />
        </div>

        {/* ZONE 3 — IMPACT OF TURN N. Mounted only on the "wide" tier. */}
        {showImpactColumn && (
          <div className="max-h-[560px] overflow-y-auto bg-[var(--hg-bg)]">
            <ImpactPanel model={model} cursor={cursor} turn={currentTurn} />
          </div>
        )}
      </div>

      <TurnFooter model={model} turn={currentTurn} cursor={cursor} />
    </div>
  );
}

/* ================================================================== *
 * ZONE 1a — Stat-bar (fixed). DISPLAY-ONLY session meta + the TRANSPORT.
 * It shows what is playing (source dot · title · harness · model · window x/cap
 * · turns) and drives the cursor (⏮ prev · ▶/⏸ play/pause · ⏭ next · turn N/T).
 * Session SELECTION lives in the left rail, not here.
 * ================================================================== */
function SessionHeader({
  model,
  cursor,
  playing,
  onPrev,
  onNext,
  onTogglePlay,
}: {
  model: SessionModel;
  cursor: number;
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
}) {
  const nowTotal = compositionAt(model, cursor).total;
  const lastRow = model.turns.length - 1;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] px-4 py-2.5">
      {/* current session — display only */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: sourceAccent(model.source) }}
        />
        <span
          className="max-w-[280px] truncate text-[13px] font-medium text-[var(--hg-ink)]"
          title={model.title}
        >
          {model.title}
        </span>
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

      <div className="ml-auto">
        <Transport
          playing={playing}
          cursor={cursor}
          lastRow={lastRow}
          total={model.turns.length}
          onPrev={onPrev}
          onNext={onNext}
          onTogglePlay={onTogglePlay}
        />
      </div>
    </div>
  );
}

/* ================================================================== *
 * Transport — ⏮ prev · ▶/⏸ play/pause · ⏭ next, plus a `turn N / T` counter.
 * PLAY auto-advances the cursor toward the end; the icon flips to ⏸ while
 * running and back to ▶ at the last turn. prev is disabled at the first turn,
 * next at the last. Keyboard: space = play/pause, ←/→ = prev/next.
 * ================================================================== */
function Transport({
  playing,
  cursor,
  lastRow,
  total,
  onPrev,
  onNext,
  onTogglePlay,
}: {
  playing: boolean;
  cursor: number;
  lastRow: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
}) {
  const atStart = cursor <= 0;
  const atEnd = cursor >= lastRow;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--hg-line)] bg-[var(--hg-surface)] px-1.5 py-1">
      <TransportButton
        label="prev turn"
        title="Previous turn (←)"
        onClick={onPrev}
        disabled={atStart}
      >
        <SkipBack size={13} />
      </TransportButton>

      <button
        type="button"
        onClick={onTogglePlay}
        aria-pressed={playing}
        title={playing ? "Pause (space)" : "Play — auto-advance one turn at a time (space)"}
        className={
          "inline-flex h-6 w-6 items-center justify-center rounded-[4px] border transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)] " +
          (playing
            ? "border-[var(--hg-accent)] bg-[var(--hg-accent)] text-[#0a0d10]"
            : "border-[var(--hg-line)] bg-[var(--hg-surface-2)] text-[var(--hg-ink)] hover:border-[var(--hg-hairline)]")
        }
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>

      <TransportButton
        label="next turn"
        title="Next turn (→)"
        onClick={onNext}
        disabled={atEnd}
      >
        <SkipForward size={13} />
      </TransportButton>

      <span className="ml-1 pl-1.5 pr-1 hg-mono text-[10px] tabular-nums text-[var(--hg-ink-2)]">
        <span className="text-[var(--hg-accent)]">turn {cursor + 1}</span>
        <span className="text-[var(--hg-muted)]"> / {total}</span>
      </span>
    </div>
  );
}

function TransportButton({
  label,
  title,
  onClick,
  disabled,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-transparent text-[var(--hg-ink-2)] transition-colors outline-none hover:border-[var(--hg-line)] hover:bg-[var(--hg-surface-2)] hover:text-[var(--hg-ink)] focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)] disabled:cursor-not-allowed disabled:text-[var(--hg-line)] disabled:hover:border-transparent disabled:hover:bg-transparent"
    >
      {children}
    </button>
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

/* ================================================================== *
 * ZONE 1b — Accumulation mountain (fixed). Compact stacked AREA of cumulative
 * window tokens by turn, with a vertical playhead at the cursor. X = row
 * position (0..N-1), Y = cumulative tokens, stacked by bucket. Region ≤ cursor
 * is bright; ahead-of-cursor is faint. Click/drag scrubs to a row (which
 * scrolls the log there).
 * ================================================================== */
const CHART_W = 1000;
const CHART_H = 168;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 4;

function AccumulationBand({
  model,
  cursor,
  onScrubToRow,
}: {
  model: SessionModel;
  cursor: number;
  onScrubToRow: (rowIdx: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverRow, setHoverRow] = useState<number | null>(null);

  const lastRow = model.turns.length - 1;
  const span = Math.max(1, lastRow);
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;

  // stacked buckets, biggest overall on the bottom (stable draw order).
  const stackOrder = useMemo(() => {
    const totals = new Map<ContextBucketId, number>();
    const last = model.cumByTurn.length ? model.cumByTurn[model.cumByTurn.length - 1] : new Map();
    for (const b of model.presentBuckets) totals.set(b, last.get(b) ?? 0);
    return [...model.presentBuckets].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
  }, [model]);

  // sample the accrual at every row (step function between turns).
  const samples = useMemo(() => {
    const out: { x: number; stack: Map<ContextBucketId, number>; total: number }[] = [];
    out.push({ x: 0, stack: new Map(), total: 0 }); // flat baseline before turn 0
    model.turns.forEach((_, i) => {
      out.push({ x: i, stack: model.cumByTurn[i], total: model.cumTotalByTurn[i] });
    });
    return out;
  }, [model]);

  const yMax = Math.max(1, model.peakTotal);
  const xOf = (rowIdx: number) => PAD_L + (rowIdx / span) * plotW;
  const yOf = (v: number) => PAD_T + plotH - (v / yMax) * plotH;

  const bucketAreas = useMemo(() => {
    const areas: { bucket: ContextBucketId; color: string; d: string }[] = [];
    const baseline = samples.map(() => 0);
    for (const bucket of [...stackOrder].reverse()) {
      const meta = bucketMeta(bucket);
      const tops = samples.map((s, i) => baseline[i] + (s.stack.get(bucket) ?? 0));
      let d = "";
      samples.forEach((s, i) => {
        const x = xOf(s.x);
        if (i === 0) d += `M ${x.toFixed(2)} ${yOf(tops[i]).toFixed(2)} `;
        else {
          d += `L ${x.toFixed(2)} ${yOf(tops[i - 1]).toFixed(2)} `;
          d += `L ${x.toFixed(2)} ${yOf(tops[i]).toFixed(2)} `;
        }
      });
      for (let i = samples.length - 1; i >= 0; i--) {
        const x = xOf(samples[i].x);
        d += `L ${x.toFixed(2)} ${yOf(baseline[i]).toFixed(2)} `;
        if (i > 0) d += `L ${xOf(samples[i - 1].x).toFixed(2)} ${yOf(baseline[i]).toFixed(2)} `;
      }
      d += "Z";
      areas.push({ bucket, color: meta.color, d });
      samples.forEach((_, i) => (baseline[i] = tops[i]));
    }
    return areas.reverse();
  }, [samples, stackOrder, span, yMax]);

  const playX = xOf(cursor);
  const clipId = `observe-past-${model.id.replace(/[^a-z0-9]/gi, "")}`;

  const rowFromClientX = useCallback(
    (clientX: number): number => {
      const el = svgRef.current;
      if (!el) return cursor;
      const rect = el.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * CHART_W;
      const frac = Math.min(1, Math.max(0, (px - PAD_L) / plotW));
      return Math.round(frac * span);
    },
    [span, plotW, cursor],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      setDragging(true);
      onScrubToRow(rowFromClientX(e.clientX));
    },
    [onScrubToRow, rowFromClientX],
  );
  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      setHoverRow(rowFromClientX(e.clientX));
      if (dragging) onScrubToRow(rowFromClientX(e.clientX));
    },
    [dragging, onScrubToRow, rowFromClientX],
  );
  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    setDragging(false);
  }, []);

  return (
    <section className="px-4 pt-2.5 pb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="hg-section-label">accumulation · cumulative window tokens by turn</span>
        <BucketLegend buckets={model.presentBuckets} />
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="none"
          className="h-[168px] w-full cursor-ew-resize touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHoverRow(null)}
          role="slider"
          aria-label="playhead"
          aria-valuemin={0}
          aria-valuemax={lastRow}
          aria-valuenow={cursor}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD_L} y={0} width={Math.max(0, playX - PAD_L)} height={CHART_H} />
            </clipPath>
          </defs>

          {/* baseline */}
          <line
            x1={PAD_L}
            x2={CHART_W - PAD_R}
            y1={yOf(0)}
            y2={yOf(0)}
            stroke="var(--hg-line)"
            strokeWidth={0.75}
          />

          {/* AHEAD-OF-CURSOR (faint) — full stack dim underneath */}
          <g opacity={0.16}>
            {bucketAreas.map((a) => (
              <path key={`f-${a.bucket}`} d={a.d} fill={a.color} />
            ))}
          </g>

          {/* AT-OR-BEFORE-CURSOR (bright) — same stack clipped to ≤ cursor */}
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
            strokeOpacity={0.3}
            strokeWidth={1}
          />

          {/* hover marker */}
          {hoverRow !== null && hoverRow !== cursor && (
            <line
              x1={xOf(hoverRow)}
              x2={xOf(hoverRow)}
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
          {axisRows(model).map((rowIdx) => (
            <span
              key={rowIdx}
              className="absolute hg-mono text-[8px] tabular-nums text-[var(--hg-muted)]"
              style={{ left: `${(xOf(rowIdx) / CHART_W) * 100}%`, transform: "translateX(-50%)" }}
            >
              t{model.turnOrder[rowIdx]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Stepped top outline of the cumulative total. */
function outlinePath(
  samples: { x: number; total: number }[],
  xOf: (rowIdx: number) => number,
  yOf: (v: number) => number,
): string {
  let d = "";
  samples.forEach((s, i) => {
    const x = xOf(s.x);
    if (i === 0) d += `M ${x.toFixed(2)} ${yOf(s.total).toFixed(2)} `;
    else {
      d += `L ${x.toFixed(2)} ${yOf(samples[i - 1].total).toFixed(2)} `;
      d += `L ${x.toFixed(2)} ${yOf(s.total).toFixed(2)} `;
    }
  });
  return d;
}

function axisRows(model: SessionModel): number[] {
  const lastRow = model.turns.length - 1;
  if (lastRow <= 0) return [0];
  const step = Math.max(1, Math.round(lastRow / 8));
  const out: number[] = [];
  for (let i = 0; i <= lastRow; i += step) out.push(i);
  if (out[out.length - 1] !== lastRow) out.push(lastRow);
  return out;
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
 * ZONE 2 — Conversation log (the scrolling axis). One TurnRow per turn,
 * top→bottom, a spine down the left with a colored bead per row. Each row is
 * neutral: a role chip, a short gist, its token delta, and which buckets it
 * added to. Clicking a row seeks the cursor (and, on narrow layouts, expands
 * that row's inline impact). Below 1440px of viewport the right column is gone,
 * so the active row surfaces its impact inline instead.
 * ================================================================== */
function ConversationLog({
  model,
  cursor,
  showInlineImpact,
  onSeekRow,
  registerRow,
}: {
  model: SessionModel;
  cursor: number;
  showInlineImpact: boolean;
  onSeekRow: (rowIdx: number) => void;
  registerRow: (rowIdx: number, el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="relative px-4 pt-4 pb-24">
      {/* the spine */}
      <div className="pointer-events-none absolute bottom-24 left-[42px] top-4 w-px bg-[var(--hg-line)]" />
      <div className="flex flex-col">
        {model.turns.map((row, i) => (
          <TurnRowView
            key={row.turnIndex}
            model={model}
            row={row}
            rowIdx={i}
            isCurrent={i === cursor}
            isPast={i <= cursor}
            showInlineImpact={showInlineImpact}
            onSeek={() => onSeekRow(i)}
            registerRow={registerRow}
          />
        ))}
      </div>
    </div>
  );
}

function TurnRowView({
  model,
  row,
  rowIdx,
  isCurrent,
  isPast,
  showInlineImpact,
  onSeek,
  registerRow,
}: {
  model: SessionModel;
  row: TurnRow;
  rowIdx: number;
  isCurrent: boolean;
  isPast: boolean;
  showInlineImpact: boolean;
  onSeek: () => void;
  registerRow: (rowIdx: number, el: HTMLDivElement | null) => void;
}) {
  const meta = ROLE_META[row.role];
  const Icon = meta.Icon;
  const gist = turnGist(row);
  const sub = turnSubGist(row);

  const deltaBuckets = useMemo(
    () =>
      CONTEXT_BUCKETS.map((b) => ({
        id: b.id,
        label: b.label,
        color: b.color,
        tokens: row.bucketDelta.get(b.id) ?? 0,
      }))
        .filter((x) => x.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens),
    [row],
  );

  return (
    <div
      ref={(el) => registerRow(rowIdx, el)}
      data-row-idx={rowIdx}
      className="relative pb-4 pl-[54px]"
    >
      {/* turn index (left gutter) */}
      <div
        className={
          "absolute left-0 top-[3px] w-[30px] text-right hg-mono text-[9px] tabular-nums " +
          (isCurrent ? "text-[var(--hg-accent)]" : "text-[var(--hg-muted)]")
        }
      >
        t{row.turnIndex}
      </div>

      {/* bead on the spine */}
      <span
        className="absolute left-[38px] top-[5px] h-[9px] w-[9px] rounded-full"
        style={{
          background: isCurrent ? "var(--hg-accent)" : meta.hue,
          opacity: isPast ? 1 : 0.4,
          boxShadow: "0 0 0 3px var(--hg-bg)",
        }}
      />

      {/* the block — clicking it seeks the cursor to this turn */}
      <button
        type="button"
        onClick={onSeek}
        aria-current={isCurrent}
        className={
          "block w-full rounded-[5px] border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--hg-accent)] " +
          (isCurrent
            ? "border-[var(--hg-accent)] bg-[var(--hg-surface-2)]"
            : isPast
              ? "border-[var(--hg-line)] bg-[var(--hg-surface)] hover:border-[var(--hg-hairline)]"
              : "border-[var(--hg-line)] bg-[var(--hg-bg-tint)] opacity-70 hover:opacity-100")
        }
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-0.5 hg-mono text-[8.5px] uppercase tracking-[0.08em]"
            style={{ background: `${meta.hue}22`, color: meta.hue }}
          >
            <Icon size={10} />
            {meta.label}
          </span>
          <span className="min-w-0 flex-1 truncate hg-mono text-[11.5px] lowercase text-[var(--hg-ink)]">
            {gist}
          </span>
          {row.pinned && (
            <span className="shrink-0 hg-mono text-[8px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
              pinned
            </span>
          )}
          <span className="shrink-0 hg-mono text-[11px] tabular-nums text-[var(--hg-ink-2)]">
            +{formatAnalysisTokens(row.delta)}
          </span>
        </div>

        {sub && (
          <div className="mt-1 truncate pl-0.5 hg-mono text-[9.5px] lowercase text-[var(--hg-muted)]">
            {sub}
          </div>
        )}

        {/* which buckets this turn added to */}
        {deltaBuckets.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {deltaBuckets.map((seg) => (
              <span
                key={seg.id}
                className="inline-flex items-center gap-1 hg-mono text-[8.5px] lowercase text-[var(--hg-muted)]"
              >
                <span className="h-1.5 w-1.5 rounded-[1px]" style={{ background: seg.color }} />
                {seg.label} +{formatAnalysisTokens(seg.tokens)}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Inline impact: when the right column is collapsed (below the "wide"
          tier), the ACTIVE row expands its window-as-of-N composition inline so
          the impact detail is never lost. */}
      {isCurrent && showInlineImpact && (
        <div className="mt-2">
          <InlineWindowImpact model={model} cursor={rowIdx} />
        </div>
      )}
    </div>
  );
}

/** Compact window-as-of-N composition shown inline on narrow layouts. */
function InlineWindowImpact({ model, cursor }: { model: SessionModel; cursor: number }) {
  const { comp, total } = compositionAt(model, cursor);
  const compRows = useMemo(
    () =>
      CONTEXT_BUCKETS.map((b) => ({
        id: b.id,
        label: b.label,
        color: b.color,
        tokens: comp.get(b.id) ?? 0,
      })).filter((x) => x.tokens > 0),
    [comp],
  );

  return (
    <div className="rounded-[5px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] px-3 py-2.5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="hg-mono text-[8.5px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
          window as of turn {model.turnOrder[cursor]}
        </span>
        <span className="hg-mono text-[11px] font-semibold tabular-nums text-[var(--hg-ink)]">
          {formatAnalysisTokens(total)}
        </span>
      </div>
      <CompositionBar compRows={compRows} total={total} />
    </div>
  );
}

/* ================================================================== *
 * ZONE 3 — Impact panel (right column). Lifted from the former
 * SessionFillPrototype's ImpactPanel: the impact of the CURRENT (cursor) turn
 * and the window as of that turn. Tracks the cursor continuously as the log
 * scrolls, and updates when a specific row is clicked. Neutral; no scoring.
 * ================================================================== */
function ImpactPanel({
  model,
  cursor,
  turn,
}: {
  model: SessionModel;
  cursor: number;
  turn: number;
}) {
  const thisTurn = model.turns[cursor] ?? null;
  const { comp, total } = compositionAt(model, cursor);

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
        id: b.id,
        label: b.label,
        color: b.color,
        tokens: comp.get(b.id) ?? 0,
      })).filter((x) => x.tokens > 0),
    [comp],
  );

  const roleMeta = thisTurn ? ROLE_META[thisTurn.role] : null;
  const RoleIcon = roleMeta?.Icon;
  const gist = thisTurn ? turnGist(thisTurn) : "";

  return (
    <div className="flex flex-col">
      {/* IMPACT OF TURN N */}
      <section className="border-b border-[var(--hg-line)] px-4 py-3">
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
                title={gist}
              >
                {gist}
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
              {deltaRows.length === 0 && (
                <div className="hg-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">
                  no bucket growth this turn
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* WINDOW AS OF TURN N */}
      <section className="px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="hg-section-label">window as of turn {turn}</span>
          <span className="hg-mono text-[13px] font-semibold tabular-nums text-[var(--hg-ink)]">
            {formatAnalysisTokens(total)}
          </span>
        </div>

        <CompositionBar compRows={compRows} total={total} />

        <div className="mt-2.5 flex flex-col gap-1">
          {compRows.map((seg) => (
            <div key={seg.id} className="flex items-center gap-2">
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
      </section>
    </div>
  );
}

/** Shared running-composition stacked bar (cumulative bucket tokens ≤ cursor). */
function CompositionBar({
  compRows,
  total,
}: {
  compRows: Array<{ id: ContextBucketId; label: string; color: string; tokens: number }>;
  total: number;
}) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg)]">
      {compRows.map((seg) => (
        <span
          key={seg.id}
          title={`${seg.label} · ${formatAnalysisTokens(seg.tokens)}`}
          style={{ flexGrow: seg.tokens, flexBasis: 0, background: seg.color, opacity: 0.85 }}
        />
      ))}
      {total === 0 && <span className="flex-1" />}
    </div>
  );
}

/* ================================================================== *
 * Footer — the window composition as of the cursor, pinned at the bottom of
 * the instrument so the accumulated total is always visible while reading the
 * conversation. Neutral; no scoring.
 * ================================================================== */
function TurnFooter({
  model,
  turn,
  cursor,
}: {
  model: SessionModel;
  turn: number;
  cursor: number;
}) {
  const { comp, total } = compositionAt(model, cursor);
  const compRows = useMemo(
    () =>
      CONTEXT_BUCKETS.map((b) => ({
        id: b.id,
        label: b.label,
        color: b.color,
        tokens: comp.get(b.id) ?? 0,
      })).filter((x) => x.tokens > 0),
    [comp],
  );

  return (
    <div className="flex items-center gap-4 border-t border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] px-4 py-2.5">
      <div className="flex shrink-0 flex-col leading-none">
        <span className="hg-mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--hg-muted)]">
          window as of t{turn}
        </span>
        <span className="mt-1 hg-mono text-[13px] font-semibold tabular-nums text-[var(--hg-ink)]">
          {formatAnalysisTokens(total)}
        </span>
      </div>

      {/* running composition stacked bar (cumulative bucket tokens ≤ cursor) */}
      <div className="flex h-3 min-w-0 flex-1 overflow-hidden rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg)]">
        {compRows.map((seg) => (
          <span
            key={seg.id}
            title={`${seg.label} · ${formatAnalysisTokens(seg.tokens)}`}
            style={{ flexGrow: seg.tokens, flexBasis: 0, background: seg.color, opacity: 0.82 }}
          />
        ))}
        {total === 0 && <span className="flex-1" />}
      </div>

      <span className="shrink-0 hg-mono text-[9px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
        ← → step · space play/pause · turn {cursor + 1} of {model.turns.length}
      </span>
    </div>
  );
}
