import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { SidePanel } from "hudsonkit/chrome";
import { BarChart3, GitBranch, ListTree, PieChart, Send, Terminal } from "lucide-react";

import {
  ANALYSIS_THRESHOLDS,
  DEFAULT_ENGINE_BUDGET,
  bucketMeta,
  formatAnalysisTokens,
  topAllocations,
  type BucketAllocation,
  type BucketInsight,
  type AnalysisQuestionId,
  type ContextBlock,
  type ContextAtom,
  type ContextBucketId,
  type ContextSlice,
  type RecipeSlot,
  type SessionAnalysis,
  type SessionAnalysisResponse,
  type ThresholdSnapshot,
} from "@/lib/sessionAnalysis";
import { askSessionAnalysis, fetchSessionAnalysis } from "@/lib/sessionAnalysisClient";

interface AnalysisState {
  data: SessionAnalysisResponse | null;
  loading: boolean;
  error: string | null;
  activeId: string;
  setActiveId: (id: string) => void;
  threshold: number;
  setThreshold: (threshold: number) => void;
  selectedBucket: ContextBucketId;
  setSelectedBucket: (bucket: ContextBucketId) => void;
  questionId: AnalysisQuestionId;
  setQuestionId: (id: AnalysisQuestionId) => void;
  selectedBlockIds: string[];
  toggleBlock: (id: string) => void;
  blockDrafts: Record<string, string>;
  setBlockDraft: (id: string, body: string) => void;
  active: SessionAnalysis | null;
  activeSnapshot: ThresholdSnapshot | null;
  selectedInsight: BucketInsight | null;
}

export function useSessionAnalysisState(): AnalysisState {
  const [data, setData] = useState<SessionAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState("");
  const [threshold, setThreshold] = useState<number>(150_000);
  const [selectedBucket, setSelectedBucket] = useState<ContextBucketId>("codebase");
  const [questionId, setQuestionId] = useState<AnalysisQuestionId>("shape");
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [blockDrafts, setBlockDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSessionAnalysis()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
        setActiveId(
          (current) =>
            current ||
            next.sessions.find((session) => session.goodContext?.rank === 1)?.id ||
            next.sessions.find((session) => session.goodContext)?.id ||
            next.sessions[0]?.id ||
            "",
        );
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => data?.sessions.find((session) => session.id === activeId) ?? data?.sessions[0] ?? null,
    [activeId, data],
  );

  const activeSnapshot = useMemo(() => {
    if (!active) return null;
    return (
      active.snapshots.find((snapshot) => snapshot.threshold === threshold) ??
      active.snapshots[active.snapshots.length - 1] ??
      null
    );
  }, [active, threshold]);

  const selectedInsight = useMemo(
    () => active?.bucketInsights.find((insight) => insight.bucket === selectedBucket) ?? null,
    [active, selectedBucket],
  );

  useEffect(() => {
    if (!active) return;
    setSelectedBlockIds(
      active.recipeDraft.blocks.filter((block) => block.includedDefault).map((block) => block.id),
    );
    setBlockDrafts(
      Object.fromEntries(active.recipeDraft.blocks.map((block) => [block.id, block.body])),
    );
  }, [active?.recipeDraft.id]);

  const toggleBlock = (id: string) => {
    setSelectedBlockIds((current) =>
      current.includes(id) ? current.filter((blockId) => blockId !== id) : [...current, id],
    );
  };

  const setBlockDraft = (id: string, body: string) => {
    setBlockDrafts((current) => ({ ...current, [id]: body }));
  };

  return {
    data,
    loading,
    error,
    activeId: active?.id ?? activeId,
    setActiveId,
    threshold,
    setThreshold,
    selectedBucket,
    setSelectedBucket,
    questionId,
    setQuestionId,
    selectedBlockIds,
    toggleBlock,
    blockDrafts,
    setBlockDraft,
    active,
    activeSnapshot,
    selectedInsight,
  };
}

interface AnalysisChromeProps {
  state: AnalysisState;
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onResizeLeft: (e: MouseEvent) => void;
  onResizeRight: (e: MouseEvent) => void;
}

export function AnalysisChrome({
  state,
  leftWidth,
  rightWidth,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
  onResizeLeft,
  onResizeRight,
}: AnalysisChromeProps) {
  return (
    <>
      <SidePanel
        side="left"
        title="SESSION ANALYSIS"
        icon={<BarChart3 size={12} className="text-[var(--hg-accent)]" />}
        width={leftWidth}
        onResizeStart={onResizeLeft}
        isCollapsed={leftCollapsed}
        onToggleCollapse={onToggleLeft}
      >
        <SessionList state={state} />
      </SidePanel>

      <SidePanel
        side="right"
        title="ALLOCATION"
        icon={<PieChart size={12} className="text-[var(--hg-accent)]" />}
        width={rightWidth}
        onResizeStart={onResizeRight}
        isCollapsed={rightCollapsed}
        onToggleCollapse={onToggleRight}
      >
        <AllocationInspector state={state} />
      </SidePanel>
    </>
  );
}

function SessionList({ state }: { state: AnalysisState }) {
  if (state.loading) return <PanelEmpty label="loading session corpus" />;
  if (state.error) return <PanelEmpty label={state.error} tone="warn" />;
  if (!state.data?.sessions.length) return <PanelEmpty label="no sessions found" />;

  const groups = ["Scout", "Hudson", "Talkie"] as const;
  return (
    <div className="px-3 py-3 overflow-auto">
      {groups.map((project) => {
        const sessions = state.data!.sessions.filter((session) => session.project === project);
        if (!sessions.length) return null;
        return (
          <section key={project} className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="hg-section-label">{project}</span>
              <span className="hg-pill">{sessions.length}</span>
            </div>
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => state.setActiveId(session.id)}
                  className={
                    "w-full text-left rounded-[2px] border px-3 py-2.5 transition-colors " +
                    (state.activeId === session.id
                      ? "border-[var(--hg-accent)] bg-[var(--hg-accent-tint)]"
                      : "border-[var(--hg-line)] bg-[var(--hg-surface)] hover:border-[var(--hg-hairline)]")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)] truncate">
                      {session.title}
                    </span>
                    <span className="ml-auto hg-mono text-[9px] text-[var(--hg-muted)]">
                      {formatAnalysisTokens(session.contextTokens)}
                    </span>
                  </div>
                  {session.goodContext && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="hg-pill accent">good context</span>
                      <span className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)] truncate">
                        {session.goodContext.label}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 hg-mono text-[9px] text-[var(--hg-muted)] truncate">
                    {session.id}
                  </div>
                  <MiniBudgetBar used={session.contextTokens} budget={session.engineBudget} />
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AllocationInspector({ state }: { state: AnalysisState }) {
  const session = state.active;
  const snapshot = state.activeSnapshot;
  if (!session || !snapshot) return <PanelEmpty label="select a session" />;
  const budget = session.engineBudget || DEFAULT_ENGINE_BUDGET;

  return (
    <div className="px-4 py-4 overflow-auto">
      <div className="mb-4 rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="hg-section-label">engine footprint</span>
          <span className="hg-mono text-[10px] text-[var(--hg-muted)]">
            {Math.round((session.contextTokens / budget) * 100)}%
          </span>
        </div>
        <BudgetBar used={session.contextTokens} budget={budget} />
        <div className="mt-2 hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
          {formatAnalysisTokens(session.contextTokens)} / {formatAnalysisTokens(budget)}
        </div>
      </div>

      <div className="mb-4 border border-dashed border-[var(--hg-hairline)] rounded-[2px] p-3">
        <div className="hg-section-label mb-2">threshold</div>
        <div className="grid grid-cols-5 gap-1">
          {ANALYSIS_THRESHOLDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => state.setThreshold(value)}
              className={
                "hg-mono rounded-[2px] border px-1.5 py-1.5 text-[9px] uppercase tracking-wider " +
                (state.threshold === value
                  ? "border-[var(--hg-accent)] bg-[var(--hg-accent)] text-[var(--hg-bg)]"
                  : "border-[var(--hg-line)] bg-[var(--hg-bg-tint)] text-[var(--hg-muted)] hover:text-[var(--hg-ink)]")
              }
            >
              {formatAnalysisTokens(value)}
            </button>
          ))}
        </div>
      </div>

      <StackedBar allocations={snapshot.allocations} />

      <div className="mt-4 space-y-2">
        {snapshot.allocations.map((allocation) => (
          <BucketRow
            key={allocation.bucket}
            allocation={allocation}
            isSelected={state.selectedBucket === allocation.bucket}
            onSelect={() => state.setSelectedBucket(allocation.bucket)}
          />
        ))}
      </div>

      {state.selectedInsight && <BucketInsightPanel insight={state.selectedInsight} compact />}

      <section className="mt-5">
        <div className="hg-section-label mb-2">classifier notes</div>
        <div className="space-y-2">
          {session.classifierNotes.map((note) => (
            <div
              key={note}
              className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--hg-ink-2)]"
            >
              {note}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function SessionAnalysisWorkbench({ state }: { state: AnalysisState }) {
  const session = state.active;
  const snapshot = state.activeSnapshot;

  if (state.loading) {
    return <WorkbenchShell title="SESSION ANALYSIS" meta="loading" />;
  }

  if (state.error) {
    return <WorkbenchShell title="SESSION ANALYSIS" meta={state.error} tone="warn" />;
  }

  if (!session || !snapshot) {
    return <WorkbenchShell title="SESSION ANALYSIS" meta="no session selected" />;
  }

  const top = topAllocations(snapshot.allocations, 3);
  const budget = session.engineBudget || DEFAULT_ENGINE_BUDGET;
  return (
    <section className="flex-1 min-w-0 flex flex-col bg-[var(--hg-bg)] overflow-auto">
      <div className="flex-shrink-0 px-9 pt-7 pb-5 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)]">
        <div className="flex items-start gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="hg-pill accent">{session.project}</span>
              <span className="hg-pill">{session.source}</span>
              <span className="hg-pill">
                {formatAnalysisTokens(session.contextTokens)} / {formatAnalysisTokens(budget)}
              </span>
            </div>
            <h2 className="m-0 hg-mono text-[24px] font-medium tracking-wider uppercase text-[var(--hg-ink)] leading-tight">
              {session.title}
            </h2>
            <p className="mt-2 mb-0 max-w-[760px] text-[13px] leading-[1.55] text-[var(--hg-ink-2)]">
              {session.summary}
            </p>
          </div>
          <div className="ml-auto min-w-[220px] hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)] leading-[1.9] text-right">
            <MetaRow label="session" value={session.id.slice(0, 8)} />
            <MetaRow label="observed" value={session.timeLabel} />
            <MetaRow label="chunks" value={String(session.chunkCount)} />
            <MetaRow label="atoms" value={String(session.atoms.length)} />
            <MetaRow label="slices" value={String(session.slices.length)} />
            <MetaRow
              label="engine"
              value={formatAnalysisTokens(budget)}
            />
            {session.modelWindow && <MetaRow label="telemetry" value={formatAnalysisTokens(session.modelWindow)} />}
          </div>
        </div>
      </div>

      <div className="px-9 py-7 space-y-6">
        {state.data && (
          <GoodContextCohort
            sessions={state.data.sessions}
            activeId={session.id}
            onSelect={state.setActiveId}
          />
        )}

        <ContextMaterialInspector
          session={session}
          snapshot={snapshot}
          selectedBucket={state.selectedBucket}
          onSelectBucket={state.setSelectedBucket}
        />
        <PlainAllocationPanel session={session} snapshot={snapshot} />
        <ContextConsolePanel
          session={session}
          snapshot={snapshot}
          selectedBucket={state.selectedBucket}
        />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="hg-section-label">engine budget footprint</div>
              <div className="mt-1 hg-mono text-[11px] text-[var(--hg-muted)] uppercase tracking-wider">
                {formatAnalysisTokens(session.contextTokens)} used ·{" "}
                {formatAnalysisTokens(Math.max(0, budget - session.contextTokens))} available
              </div>
            </div>
            <span className="hg-pill">{Math.round((session.contextTokens / budget) * 100)}%</span>
          </div>
          <BudgetBar used={session.contextTokens} budget={budget} heightClass="h-8" />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="hg-section-label">LLM input allocation</div>
              <div className="mt-1 hg-mono text-[11px] text-[var(--hg-muted)] uppercase tracking-wider">
                {formatAnalysisTokens(snapshot.coveredTokens)} covered ·{" "}
                {snapshot.reached ? "observed" : "beyond observed context"}
              </div>
            </div>
            <div className="flex gap-1">
              {top.map((allocation) => {
                const meta = bucketMeta(allocation.bucket);
                return (
                  <span key={allocation.bucket} className="hg-pill">
                    {meta.short} {Math.round(allocation.percent)}%
                  </span>
                );
              })}
            </div>
          </div>
          <StackedBar allocations={snapshot.allocations} heightClass="h-10" />
        </section>

        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-5">
          <ThresholdMatrix session={session} activeThreshold={state.threshold} onSelect={state.setThreshold} />
          <RoutingTree snapshot={snapshot} />
        </div>

        {state.selectedInsight && <BucketInsightPanel insight={state.selectedInsight} />}
        {state.selectedInsight && (
          <AnalysisLoopPanel
            session={session}
            insight={state.selectedInsight}
            snapshot={snapshot}
            questionId={state.questionId}
            onQuestionChange={state.setQuestionId}
          />
        )}
        <ContextBuilderPanel state={state} session={session} />
      </div>
    </section>
  );
}

function GoodContextCohort({
  sessions,
  activeId,
  onSelect,
}: {
  sessions: SessionAnalysis[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const good = sessions
    .filter((session) => session.goodContext)
    .sort((a, b) => (a.goodContext?.rank ?? 99) - (b.goodContext?.rank ?? 99));

  if (!good.length) return null;

  return (
    <section className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="hg-section-label">four good contexts</div>
          <p className="m-0 mt-1 text-[13px] leading-[1.5] text-[var(--hg-ink-2)]">
            These are sessions where the setup looks useful enough to learn from: focused task,
            enough project state, and clear evidence or decisions.
          </p>
        </div>
        <span className="hg-pill accent">training ground</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {good.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelect(session.id)}
            className={
              "rounded-[2px] border px-3 py-3 text-left transition-colors " +
              (activeId === session.id
                ? "border-[var(--hg-accent)] bg-[var(--hg-accent-tint)]"
                : "border-[var(--hg-line)] bg-[var(--hg-bg-tint)] hover:border-[var(--hg-hairline)]")
            }
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="hg-pill">{session.project}</span>
              <span className="ml-auto hg-mono text-[9px] text-[var(--hg-muted)]">
                {formatAnalysisTokens(session.contextTokens)}
              </span>
            </div>
            <div className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)] leading-[1.35]">
              {session.title}
            </div>
            <div className="mt-2 text-[12px] leading-[1.45] text-[var(--hg-muted)]">
              {session.goodContext?.label}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function PlainAllocationPanel({
  session,
  snapshot,
}: {
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
}) {
  const groups = plainAllocationGroups(snapshot);
  const strongest = groups.reduce((best, group) => (group.tokens > best.tokens ? group : best), groups[0]);
  return (
    <section className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-4">
      <div className="mb-4 flex items-start gap-4">
        <div className="min-w-0">
          <div className="hg-section-label">plain-English context map</div>
          <h3 className="m-0 mt-1 hg-mono text-[18px] uppercase tracking-wider text-[var(--hg-ink)]">
            What this session is carrying
          </h3>
          <p className="m-0 mt-2 max-w-[760px] text-[13px] leading-[1.55] text-[var(--hg-ink-2)]">
            At {formatAnalysisTokens(snapshot.coveredTokens)}, this context is mostly{" "}
            <b className="font-medium text-[var(--hg-ink)]">{strongest.label.toLowerCase()}</b>.
            {session.goodContext ? ` ${session.goodContext.lesson}` : " It has not been promoted as a reusable example yet."}
          </p>
        </div>
        {session.goodContext && (
          <div className="ml-auto max-w-[360px] rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--hg-muted)]">
            <div className="mb-1 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-ink)]">
              why this one
            </div>
            {session.goodContext.reason}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.id} className="grid grid-cols-[180px_minmax(0,1fr)_72px] items-center gap-3">
            <div>
              <div className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)]">
                {group.label}
              </div>
              <div className="text-[11px] leading-[1.35] text-[var(--hg-muted)]">{group.explains}</div>
            </div>
            <div className="h-4 overflow-hidden rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg)]">
              <div
                className="h-full bg-[var(--hg-accent)] opacity-75"
                style={{ width: `${Math.min(100, group.percent)}%` }}
              />
            </div>
            <div className="hg-mono text-[10px] text-[var(--hg-muted)] text-right">
              {Math.round(group.percent)}%
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContextConsolePanel({
  session,
  snapshot,
  selectedBucket,
}: {
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  selectedBucket: ContextBucketId;
}) {
  const [input, setInput] = useState("What made this session a good context?");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; body: string; mode?: string }>>([
    {
      role: "assistant",
      body:
        "Ask about this session's context: what is useful, what is duplicated, what should become a reusable block, or what would confuse a model.",
      mode: "local",
    },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        body: `Loaded ${session.project} / ${session.title}. Ask me what is going into this context window.`,
        mode: "local",
      },
    ]);
    setInput("What made this session a good context?");
  }, [session.id]);

  const ask = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setMessages((current) => [...current, { role: "user", body: question }]);
    setInput("");
    setLoading(true);
    try {
      const response = await askSessionAnalysis({
        sessionId: session.id,
        threshold: snapshot.threshold,
        question,
      });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          body: response.answer,
          mode: response.mode === "llm" ? response.model ?? "llm" : "local analysis",
        },
      ]);
    } catch (e) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          body: e instanceof Error ? e.message : String(e),
          mode: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-[2px] border border-[var(--hg-line)] bg-[#080b0d] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Terminal size={14} className="text-[var(--hg-accent)]" />
        <span className="hg-section-label">context console</span>
        <span className="hg-pill ml-auto">whole session</span>
        <span className="hg-pill">{bucketMeta(selectedBucket).label} selected</span>
      </div>
      <div className="max-h-[300px] space-y-3 overflow-auto rounded-[2px] border border-[var(--hg-line)] bg-black/30 p-3">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <div className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
              {message.role}
              {message.mode && <div className="mt-1 normal-case tracking-normal">{message.mode}</div>}
            </div>
            <div className="whitespace-pre-wrap text-[13px] leading-[1.55] text-[var(--hg-ink-2)]">
              {message.body}
            </div>
          </div>
        ))}
        {loading && (
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <div className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">assistant</div>
            <div className="text-[13px] text-[var(--hg-muted)]">thinking through the selected context slice...</div>
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask();
            }
          }}
          className="min-w-0 flex-1 rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg)] px-3 py-2 font-mono text-[12px] text-[var(--hg-ink)] outline-none focus:border-[var(--hg-accent)]"
          placeholder="Ask about dead spots, duplication, reusable blocks..."
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={loading || !input.trim()}
          className="hg-btn primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Send size={13} />
          ask
        </button>
      </div>
    </section>
  );
}

function ContextMaterialInspector({
  session,
  snapshot,
  selectedBucket,
  onSelectBucket,
}: {
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  selectedBucket: ContextBucketId;
  onSelectBucket: (bucket: ContextBucketId) => void;
}) {
  const snapshotAtomIds = useMemo(() => new Set(snapshot.chunkRefs), [snapshot.chunkRefs]);
  const includedAtoms = useMemo(
    () => session.atoms.filter((atom) => snapshotAtomIds.has(atom.id)),
    [session.atoms, snapshotAtomIds],
  );
  const bucketAtoms = useMemo(
    () => includedAtoms.filter((atom) => atom.bucket === selectedBucket),
    [includedAtoms, selectedBucket],
  );
  const bucketSlices = useMemo(
    () =>
      session.slices
        .filter(
          (slice) =>
            slice.bucket === selectedBucket &&
            slice.atomRefs.some((atomRef) => snapshotAtomIds.has(atomRef)),
        )
        .sort((a, b) => b.tokens - a.tokens),
    [session.slices, selectedBucket, snapshotAtomIds],
  );
  const [selectedSliceId, setSelectedSliceId] = useState("");
  const [selectedAtomId, setSelectedAtomId] = useState("");

  useEffect(() => {
    setSelectedSliceId(bucketSlices[0]?.id ?? "");
    setSelectedAtomId("");
  }, [selectedBucket, session.id, snapshot.threshold]);

  const selectedSlice = bucketSlices.find((slice) => slice.id === selectedSliceId) ?? bucketSlices[0] ?? null;
  const visibleAtoms = useMemo(() => {
    const allowed = selectedSlice ? new Set(selectedSlice.atomRefs) : null;
    return bucketAtoms
      .filter((atom) => !allowed || allowed.has(atom.id))
      .sort((a, b) => b.tokens - a.tokens);
  }, [bucketAtoms, selectedSlice]);
  const selectedAtom =
    visibleAtoms.find((atom) => atom.id === selectedAtomId) ?? visibleAtoms[0] ?? null;

  useEffect(() => {
    setSelectedAtomId(visibleAtoms[0]?.id ?? "");
  }, [selectedSliceId, selectedBucket, session.id, snapshot.threshold]);

  return (
    <section className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="hg-section-label">context material inspector</div>
          <h3 className="m-0 mt-1 hg-mono text-[18px] uppercase tracking-wider text-[var(--hg-ink)]">
            See the actual context
          </h3>
          <p className="m-0 mt-2 max-w-[760px] text-[13px] leading-[1.55] text-[var(--hg-ink-2)]">
            This drills from allocation buckets into semantic slices, then into transcript atoms with raw excerpts.
            The atoms shown are the material included at the selected {formatAnalysisTokens(snapshot.coveredTokens)} threshold.
          </p>
        </div>
        <div className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)] text-right">
          <div>{includedAtoms.length} atoms in threshold</div>
          <div>{bucketAtoms.length} in selected bucket</div>
        </div>
      </div>

      <div className="grid grid-cols-[220px_minmax(260px,0.8fr)_minmax(0,1.2fr)] gap-3">
        <div className="space-y-2">
          <div className="hg-section-label mb-2">1 · buckets</div>
          {snapshot.allocations
            .filter((allocation) => allocation.tokens > 0)
            .map((allocation) => {
              const meta = bucketMeta(allocation.bucket);
              const active = allocation.bucket === selectedBucket;
              return (
                <button
                  key={allocation.bucket}
                  type="button"
                  onClick={() => onSelectBucket(allocation.bucket)}
                  className={
                    "w-full rounded-[2px] border px-3 py-2 text-left transition-colors " +
                    (active
                      ? "border-[var(--hg-accent)] bg-[var(--hg-accent-tint)]"
                      : "border-[var(--hg-line)] bg-[var(--hg-bg-tint)] hover:border-[var(--hg-hairline)]")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                    <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)]">
                      {meta.label}
                    </span>
                    <span className="ml-auto hg-mono text-[10px] text-[var(--hg-muted)]">
                      {Math.round(allocation.percent)}%
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--hg-muted)]">
                    {formatAnalysisTokens(allocation.tokens)} · {allocation.chunks} atoms
                  </div>
                </button>
              );
            })}
        </div>

        <div className="min-w-0">
          <div className="hg-section-label mb-2">2 · slices</div>
          <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
            {bucketSlices.length === 0 && (
              <div className="rounded-[2px] border border-dashed border-[var(--hg-hairline)] px-3 py-5 text-center text-[12px] text-[var(--hg-muted)]">
                no slices in this threshold
              </div>
            )}
            {bucketSlices.map((slice) => (
              <SliceButton
                key={slice.id}
                slice={slice}
                isSelected={selectedSlice?.id === slice.id}
                atomCount={slice.atomRefs.filter((atomRef) => snapshotAtomIds.has(atomRef)).length}
                onSelect={() => {
                  setSelectedSliceId(slice.id);
                  setSelectedAtomId("");
                }}
              />
            ))}
          </div>
        </div>

        <RawAtomPane
          atoms={visibleAtoms}
          selectedAtom={selectedAtom}
          onSelectAtom={setSelectedAtomId}
        />
      </div>
    </section>
  );
}

function SliceButton({
  slice,
  isSelected,
  atomCount,
  onSelect,
}: {
  slice: ContextSlice;
  isSelected: boolean;
  atomCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "w-full rounded-[2px] border px-3 py-2.5 text-left transition-colors " +
        (isSelected
          ? "border-[var(--hg-accent)] bg-[var(--hg-accent-tint)]"
          : "border-[var(--hg-line)] bg-[var(--hg-bg-tint)] hover:border-[var(--hg-hairline)]")
      }
    >
      <div className="flex items-center gap-2">
        <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)] truncate">
          {slice.lifecycle} · {slice.artifactType}
        </span>
        <span className="ml-auto hg-pill">{slice.stability}</span>
      </div>
      <div className="mt-1 text-[12px] leading-[1.4] text-[var(--hg-muted)]">{slice.summary}</div>
      <div className="mt-2 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
        {formatAnalysisTokens(slice.tokens)} · {atomCount} atoms · {slice.repoScope}
      </div>
    </button>
  );
}

function RawAtomPane({
  atoms,
  selectedAtom,
  onSelectAtom,
}: {
  atoms: ContextAtom[];
  selectedAtom: ContextAtom | null;
  onSelectAtom: (id: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="hg-section-label mb-2">3 · raw material</div>
      <div className="space-y-3">
        <AtomDetail atom={selectedAtom} />

        <div className="max-h-[160px] space-y-2 overflow-auto pr-1">
          {atoms.length === 0 && (
            <div className="rounded-[2px] border border-dashed border-[var(--hg-hairline)] px-3 py-5 text-center text-[12px] text-[var(--hg-muted)]">
              no atoms in this slice
            </div>
          )}
          {atoms.map((atom) => (
            <button
              key={atom.id}
              type="button"
              onClick={() => onSelectAtom(atom.id)}
              className={
                "w-full rounded-[2px] border px-3 py-2 text-left transition-colors " +
                (selectedAtom?.id === atom.id
                  ? "border-[var(--hg-accent)] bg-[var(--hg-accent-tint)]"
                  : "border-[var(--hg-line)] bg-[var(--hg-bg-tint)] hover:border-[var(--hg-hairline)]")
              }
            >
              <div className="flex items-center gap-2">
                <span className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-ink)] truncate">
                  {atom.label}
                </span>
                <span className="ml-auto hg-mono text-[9px] text-[var(--hg-muted)]">
                  {formatAnalysisTokens(atom.tokens)}
                </span>
              </div>
              <div className="mt-1 text-[11px] leading-[1.35] text-[var(--hg-muted)] line-clamp-2">
                {atom.summary}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AtomDetail({ atom }: { atom: ContextAtom | null }) {
  if (!atom) {
    return (
      <div className="rounded-[2px] border border-dashed border-[var(--hg-hairline)] px-3 py-5 text-center text-[12px] text-[var(--hg-muted)]">
        select an atom to see raw material
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-[2px] border border-[var(--hg-line)] bg-[#080b0d] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)] truncate">
          {atom.label}
        </span>
        {atom.pinned && <span className="hg-pill accent">pinned</span>}
        {atom.excerptTruncated && <span className="hg-pill">clipped</span>}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <InsightMetric label="source" value={atom.sourceType} />
        <InsightMetric label="tokens" value={formatAnalysisTokens(atom.tokens)} />
        <InsightMetric label="artifact" value={atom.artifactType} />
        <InsightMetric label="stability" value={atom.stability} />
      </div>
      <div className="mb-3 space-y-1 text-[11px] leading-[1.4] text-[var(--hg-muted)]">
        {atom.lineNumber && <div>Transcript line {atom.lineNumber}</div>}
        {atom.command && <div className="font-mono break-all">Command: {atom.command}</div>}
        {atom.fileRefs.length > 0 && (
          <div className="font-mono break-all">Files: {atom.fileRefs.slice(0, 4).join(", ")}</div>
        )}
        <div className="font-mono">Hash: {atom.contentHash}</div>
      </div>
      <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-[2px] border border-[var(--hg-line)] bg-black/35 p-3 text-[11px] leading-[1.45] text-[var(--hg-ink-2)]">
        {atom.excerpt || atom.summary}
      </pre>
    </div>
  );
}

function ContextBuilderPanel({
  state,
  session,
}: {
  state: AnalysisState;
  session: SessionAnalysis;
}) {
  const blocks = session.recipeDraft.blocks;
  const selected = blocks.filter((block) => state.selectedBlockIds.includes(block.id));
  const selectedTokens = selected.reduce(
    (sum, block) => sum + estimateDraftTokens(state.blockDrafts[block.id] ?? block.body, block.tokens),
    0,
  );
  const liveSlots = computeRecipeSlots(
    session.recipeDraft.slots,
    blocks,
    state.selectedBlockIds,
    state.blockDrafts,
  );
  const targetMin = session.recipeDraft.targetMin;
  const targetMax = session.recipeDraft.targetMax;
  const status =
    selectedTokens < targetMin ? "under target" : selectedTokens > targetMax ? "over target" : "sweet spot";

  return (
    <section className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-4">
      <div className="mb-4 flex items-start gap-4">
        <div>
          <div className="hg-section-label">context builder</div>
          <h3 className="m-0 mt-1 hg-mono text-[18px] uppercase tracking-wider text-[var(--hg-ink)]">
            {session.recipeDraft.title}
          </h3>
          <p className="m-0 mt-2 max-w-[720px] text-[12px] leading-[1.5] text-[var(--hg-muted)]">
            Candidate blocks are compressed drafts of LLM input context. Toggle them into a warm-start recipe,
            then edit the draft body directly before promotion.
          </p>
        </div>
        <div className="ml-auto min-w-[260px]">
          <div className="mb-2 flex items-center justify-between">
            <span className="hg-section-label">recipe load</span>
            <span className="hg-pill accent">{status}</span>
          </div>
          <BudgetBar used={selectedTokens} budget={targetMax} heightClass="h-4" />
          <div className="mt-2 hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
            {formatAnalysisTokens(selectedTokens)} / {formatAnalysisTokens(targetMin)}-
            {formatAnalysisTokens(targetMax)} target
          </div>
        </div>
      </div>

      <RecipeSlotGrid slots={liveSlots} />

      <div className="grid grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] gap-4">
        <div className="space-y-2">
          {blocks.map((block) => (
            <ContextBlockCard
              key={block.id}
              block={block}
              isSelected={state.selectedBlockIds.includes(block.id)}
              draftBody={state.blockDrafts[block.id] ?? block.body}
              onToggle={() => state.toggleBlock(block.id)}
              onDraftChange={(body) => state.setBlockDraft(block.id, body)}
            />
          ))}
        </div>

        <RecipePreview
          blocks={selected}
          drafts={state.blockDrafts}
          slots={liveSlots}
          targetMin={targetMin}
          targetMax={targetMax}
        />
      </div>
    </section>
  );
}

function RecipeSlotGrid({ slots }: { slots: RecipeSlot[] }) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {slots.map((slot) => (
        <div
          key={slot.id}
          className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] px-3 py-2"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-ink)]">
              {slot.label}
            </span>
            <span className={slot.status === "covered" ? "hg-pill accent ml-auto" : "hg-pill ml-auto"}>
              {slot.status}
            </span>
          </div>
          <BudgetBar used={slot.currentTokens} budget={slot.targetMax} heightClass="h-1.5" />
          <div className="mt-1 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
            {formatAnalysisTokens(slot.currentTokens)} / {formatAnalysisTokens(slot.targetMin)}-
            {formatAnalysisTokens(slot.targetMax)}
          </div>
          {slot.missingTokens > 0 && (
            <div className="mt-1 text-[11px] leading-[1.35] text-[var(--hg-muted)]">
              missing {formatAnalysisTokens(slot.missingTokens)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ContextBlockCard({
  block,
  isSelected,
  draftBody,
  onToggle,
  onDraftChange,
}: {
  block: ContextBlock;
  isSelected: boolean;
  draftBody: string;
  onToggle: () => void;
  onDraftChange: (body: string) => void;
}) {
  const meta = bucketMeta(block.bucket);
  const draftTokens = estimateDraftTokens(draftBody, block.tokens);
  return (
    <div
      className={
        "rounded-[2px] border bg-[var(--hg-bg-tint)] p-3 " +
        (isSelected ? "border-[var(--hg-accent)]" : "border-[var(--hg-line)]")
      }
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
        <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)] truncate">
          {block.title}
        </span>
        <span className="ml-auto hg-pill">{block.quality}</span>
      </div>
      <div className="mb-2 flex items-center gap-2 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
        <span>{block.kind}</span>
        <span>{block.lifecycle}</span>
        <span>{block.artifactType}</span>
        <span>source {formatAnalysisTokens(block.sourceTokens)}</span>
        <span>draft {formatAnalysisTokens(draftTokens)}</span>
      </div>
      <div className="mb-2 flex items-center gap-2 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
        <span>{block.repoScope}</span>
        <span>{block.stability}</span>
        <span>{block.atomRefs.length} atoms</span>
        <span>{block.sliceIds.length} slices</span>
      </div>
      <div className="mb-2 text-[12px] leading-[1.45] text-[var(--hg-muted)]">{block.summary}</div>
      {block.provenance.length > 0 && (
        <div className="mb-2 rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] px-2 py-1.5">
          <div className="mb-1 hg-mono text-[8px] uppercase tracking-wider text-[var(--hg-muted)]">
            provenance
          </div>
          <div className="space-y-1">
            {block.provenance.slice(0, 2).map((item) => (
              <div key={item.atomId} className="text-[11px] leading-[1.35] text-[var(--hg-muted)]">
                {item.lineNumber ? `line ${item.lineNumber} · ` : ""}
                {item.label}: {item.summary}
              </div>
            ))}
          </div>
        </div>
      )}
      <textarea
        value={draftBody}
        onChange={(event) => onDraftChange(event.target.value)}
        className="min-h-[110px] w-full resize-y rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg)] px-3 py-2 font-mono text-[11px] leading-[1.45] text-[var(--hg-ink-2)] outline-none focus:border-[var(--hg-accent)]"
      />
      <button
        type="button"
        onClick={onToggle}
        className={isSelected ? "hg-btn primary mt-2" : "hg-btn mt-2"}
      >
        {isSelected ? "included" : "add to recipe"}
      </button>
    </div>
  );
}

function RecipePreview({
  blocks,
  drafts,
  slots,
  targetMin,
  targetMax,
}: {
  blocks: ContextBlock[];
  drafts: Record<string, string>;
  slots: RecipeSlot[];
  targetMin: number;
  targetMax: number;
}) {
  const tokens = blocks.reduce(
    (sum, block) => sum + estimateDraftTokens(drafts[block.id] ?? block.body, block.tokens),
    0,
  );
  const missing = Math.max(0, targetMin - tokens);
  const over = Math.max(0, tokens - targetMax);

  return (
    <div className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="hg-section-label">composed input draft</span>
        <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
          {formatAnalysisTokens(tokens)}
        </span>
      </div>
      <BudgetBar used={tokens} budget={targetMax} heightClass="h-3" />
      <div className="mt-2 text-[12px] leading-[1.45] text-[var(--hg-muted)]">
        {missing > 0 && <>Needs about {formatAnalysisTokens(missing)} more high-quality context to hit the warm-start floor.</>}
        {over > 0 && <>Over target by {formatAnalysisTokens(over)}. Compress or remove lower-signal blocks.</>}
        {missing === 0 && over === 0 && <>Inside the target warm-start range.</>}
      </div>
      <div className="mt-2 text-[12px] leading-[1.45] text-[var(--hg-muted)]">
        {slots
          .filter((slot) => slot.status === "missing" || slot.status === "thin")
          .map((slot) => slot.label)
          .join(", ") || "All required slots have a first-pass cover."}
      </div>

      <div className="mt-4 space-y-3">
        {blocks.length === 0 && (
          <div className="rounded-[2px] border border-dashed border-[var(--hg-hairline)] px-3 py-5 text-center hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
            add blocks to compose an LLM input package
          </div>
        )}
        {blocks.map((block) => (
          <div key={block.id} className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] px-3 py-2">
            <div className="mb-1 hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)]">
              {block.title}
            </div>
            <div className="text-[12px] leading-[1.45] text-[var(--hg-muted)]">
              {(drafts[block.id] ?? block.body).split("\n").find(Boolean)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function slotIdForContextBlock(block: ContextBlock): string {
  if (block.kind === "task-brief" || block.kind === "open-questions") return "task-brief";
  if (["repo-map", "working-set", "interface-contract", "dependency-map", "policy-slice"].includes(block.kind)) {
    return "world-map";
  }
  if (["runtime-state", "active-diff-map", "collaboration-state"].includes(block.kind)) return "active-state";
  if (["verification-summary", "test-surface", "failure-ledger", "artifact-index"].includes(block.kind)) return "evidence";
  if (block.kind === "decision-ledger") return "decisions";
  return "handoff";
}

function computeRecipeSlots(
  slots: RecipeSlot[],
  blocks: ContextBlock[],
  selectedBlockIds: string[],
  drafts: Record<string, string>,
): RecipeSlot[] {
  const selected = new Set(selectedBlockIds);
  return slots.map((slot) => {
    const slotBlocks = blocks.filter(
      (block) => selected.has(block.id) && slotIdForContextBlock(block) === slot.id,
    );
    const currentTokens = slotBlocks.reduce(
      (sum, block) => sum + estimateDraftTokens(drafts[block.id] ?? block.body, block.tokens),
      0,
    );
    const missingTokens = Math.max(0, slot.targetMin - currentTokens);
    const status: RecipeSlot["status"] =
      currentTokens === 0 ? "missing" : missingTokens > 0 ? "thin" : currentTokens > slot.targetMax ? "overfilled" : "covered";
    return {
      ...slot,
      currentTokens,
      missingTokens,
      blockIds: slotBlocks.map((block) => block.id),
      status,
    };
  });
}

function plainAllocationGroups(snapshot: ThresholdSnapshot) {
  const get = (bucket: ContextBucketId) =>
    snapshot.allocations.find((allocation) => allocation.bucket === bucket)?.tokens ?? 0;
  const total = Math.max(1, snapshot.coveredTokens);
  return [
    {
      id: "project",
      label: "Project knowledge",
      explains: "files, APIs, architecture, standing rules",
      tokens: get("codebase") + get("policy"),
    },
    {
      id: "task",
      label: "Task state",
      explains: "the job, decisions, coordination, handoff",
      tokens: get("task") + get("decisions") + get("collaboration"),
    },
    {
      id: "evidence",
      label: "Commands and evidence",
      explains: "tool calls, logs, tests, screenshots",
      tokens: get("tools") + get("verification") + get("media"),
    },
    {
      id: "runtime",
      label: "Setup and runtime",
      explains: "branch, device, server, env, auth state",
      tokens: get("environment"),
    },
    {
      id: "history",
      label: "Old conversation",
      explains: "prior turns carried mostly as history",
      tokens: get("history"),
    },
  ].map((group) => ({
    ...group,
    percent: (group.tokens / total) * 100,
  }));
}

function estimateDraftTokens(body: string, fallback: number): number {
  const tokens = Math.ceil((body || "").length / 4);
  return Math.max(1, fallback, tokens);
}

const ANALYSIS_QUESTIONS: Array<{ id: AnalysisQuestionId; label: string }> = [
  { id: "shape", label: "what was sent?" },
  { id: "dead-spots", label: "dead spots" },
  { id: "repetition", label: "repetition" },
  { id: "similarity", label: "similarity" },
  { id: "summaries", label: "summary candidates" },
];

function AnalysisLoopPanel({
  session,
  insight,
  snapshot,
  questionId,
  onQuestionChange,
}: {
  session: SessionAnalysis;
  insight: BucketInsight;
  snapshot: ThresholdSnapshot;
  questionId: AnalysisQuestionId;
  onQuestionChange: (id: AnalysisQuestionId) => void;
}) {
  const answer = useMemo(
    () => answerAnalysisQuestion(session, insight, snapshot, questionId),
    [session, insight, snapshot, questionId],
  );
  const meta = bucketMeta(insight.bucket);
  return (
    <section className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="hg-section-label">analysis loop</span>
        <span className="hg-pill">{meta.label}</span>
        <span className="ml-auto hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
          slice · {formatAnalysisTokens(snapshot.coveredTokens)}
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ANALYSIS_QUESTIONS.map((question) => (
          <button
            key={question.id}
            type="button"
            onClick={() => onQuestionChange(question.id)}
            className={
              "hg-mono rounded-[2px] border px-2 py-1.5 text-[9px] uppercase tracking-wider " +
              (questionId === question.id
                ? "border-[var(--hg-accent)] bg-[var(--hg-accent)] text-[var(--hg-bg)]"
                : "border-[var(--hg-line)] bg-[var(--hg-bg-tint)] text-[var(--hg-muted)] hover:text-[var(--hg-ink)]")
            }
          >
            {question.label}
          </button>
        ))}
      </div>
      <div className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] p-3">
        <div className="mb-2 hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
          answer from current analysis payload
        </div>
        <div className="text-[13px] leading-[1.55] text-[var(--hg-ink-2)]">{answer}</div>
      </div>
      <div className="mt-3 rounded-[2px] border border-dashed border-[var(--hg-hairline)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--hg-muted)]">
        This is a cheap deterministic read of the selected bucket. Use the context console above when you want
        the model to answer against the selected session, threshold, and provenance.
      </div>
    </section>
  );
}

function answerAnalysisQuestion(
  session: SessionAnalysis,
  insight: BucketInsight,
  snapshot: ThresholdSnapshot,
  questionId: AnalysisQuestionId,
): string {
  const meta = bucketMeta(insight.bucket);
  const dominant = topAllocations(snapshot.allocations, 3)
    .map((allocation) => `${bucketMeta(allocation.bucket).label} ${Math.round(allocation.percent)}%`)
    .join(", ");
  const examples = insight.examples
    .slice(0, 2)
    .map((example) => `${example.label}: ${example.summary}`)
    .join(" / ");

  if (questionId === "dead-spots") {
    if (insight.tightness === "noisy") {
      return `${session.title} has a likely dead spot in ${meta.label}: ${insight.chunks} chunks are spread across the slice, and the top examples do not dominate. This is a good candidate for compression into a smaller artifact before sending to a model.`;
    }
    return `${session.title} does not look obviously dead in ${meta.label}. The slice is ${insight.tightness}, with ${insight.chunks} chunks and ${Math.round(insight.percent)}% of the analyzed context. The thing to inspect is whether the examples are still relevant: ${examples}`;
  }

  if (questionId === "repetition") {
    return `${meta.label} is ${insight.recurrence.label}. That suggests this bucket is not just local noise; repeated shape across sessions should become a reusable context artifact if the examples are semantically stable. Current examples: ${examples}`;
  }

  if (questionId === "similarity") {
    return `${session.title} is most comparable on bucket shape where ${meta.label} appears above threshold. The current threshold is dominated by ${dominant}. A stronger next pass should compare this vector against the past 20 sessions and cluster by task type, repo area, and evidence load.`;
  }

  if (questionId === "summaries") {
    return `A candidate context summary for ${meta.label}: ${insight.summary} Promote only the durable part. Keep raw examples as provenance and avoid carrying full tool output unless it is still needed for verification.`;
  }

  return `${session.title} at ${formatAnalysisTokens(snapshot.coveredTokens)} sends an LLM input context dominated by ${dominant}. Inside ${meta.label}, the largest signals are: ${examples}`;
}

function ThresholdMatrix({
  session,
  activeThreshold,
  onSelect,
}: {
  session: SessionAnalysis;
  activeThreshold: number;
  onSelect: (threshold: number) => void;
}) {
  return (
    <section>
      <div className="hg-section-label mb-3">threshold snapshots</div>
      <div className="space-y-2">
        {session.snapshots.map((snapshot) => (
          <button
            key={snapshot.threshold}
            type="button"
            onClick={() => onSelect(snapshot.threshold)}
            className={
              "w-full rounded-[2px] border px-3 py-3 text-left transition-colors " +
              (activeThreshold === snapshot.threshold
                ? "border-[var(--hg-accent)] bg-[var(--hg-accent-tint)]"
                : "border-[var(--hg-line)] bg-[var(--hg-surface)] hover:border-[var(--hg-hairline)]")
            }
          >
            <div className="mb-2 flex items-center gap-3">
              <span className="hg-mono text-[11px] uppercase tracking-wider text-[var(--hg-ink)]">
                {formatAnalysisTokens(snapshot.threshold)}
              </span>
              <span className={snapshot.reached ? "hg-pill accent" : "hg-pill"}>
                {snapshot.reached ? "observed" : "projected"}
              </span>
              <span className="ml-auto hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
                {formatAnalysisTokens(snapshot.coveredTokens)}
              </span>
            </div>
            <StackedBar allocations={snapshot.allocations} heightClass="h-4" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="hg-pill">pinned {formatAnalysisTokens(snapshot.pinnedTokens)}</span>
              <span className="hg-pill">tail {formatAnalysisTokens(snapshot.tailTokens)}</span>
              <span className="hg-pill">{snapshot.chunkRefs.length} atoms</span>
            </div>
            <div className="mt-2 text-[11px] leading-[1.4] text-[var(--hg-muted)]">
              {snapshot.strategy}. Marginal:{" "}
              {topAllocations(snapshot.deltaFromPrevious, 2)
                .map((allocation) => `${bucketMeta(allocation.bucket).short} ${formatAnalysisTokens(allocation.tokens)}`)
                .join(", ")}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RoutingTree({ snapshot }: { snapshot: ThresholdSnapshot }) {
  const byBucket = new Map(snapshot.allocations.map((allocation) => [allocation.bucket, allocation]));
  const get = (bucket: ContextBucketId) => byBucket.get(bucket)?.percent ?? 0;
  const routes = [
    {
      icon: <ListTree size={14} />,
      label: "world map",
      value: get("codebase") + get("policy") + get("environment"),
      detail: "repo, rules, branch, runtime",
    },
    {
      icon: <GitBranch size={14} />,
      label: "work state",
      value: get("task") + get("decisions") + get("collaboration"),
      detail: "goal, rationale, owner",
    },
    {
      icon: <BarChart3 size={14} />,
      label: "evidence load",
      value: get("tools") + get("verification") + get("media"),
      detail: "commands, logs, checks, media",
    },
  ];

  return (
    <section>
      <div className="hg-section-label mb-3">LLM context routing</div>
      <div className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-3">
        <div className="mb-3 hg-mono text-[11px] uppercase tracking-wider text-[var(--hg-ink)]">
          input context
        </div>
        <div className="space-y-2">
          {routes.map((route) => (
            <div key={route.label} className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-[var(--hg-accent)]">{route.icon}</span>
                <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)]">
                  {route.label}
                </span>
                <span className="ml-auto hg-mono text-[10px] text-[var(--hg-muted)]">
                  {Math.round(route.value)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-[1px] bg-[var(--hg-line)]">
                <div
                  className="h-full bg-[var(--hg-accent)]"
                  style={{ width: `${Math.min(100, route.value)}%` }}
                />
              </div>
              <div className="mt-2 text-[12px] text-[var(--hg-muted)]">{route.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BudgetBar({
  used,
  budget,
  heightClass = "h-3",
}: {
  used: number;
  budget: number;
  heightClass?: string;
}) {
  const pct = Math.min(100, Math.max(0, (used / Math.max(1, budget)) * 100));
  return (
    <div className={`${heightClass} overflow-hidden rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg)]`}>
      <div
        className="h-full bg-[var(--hg-accent)] opacity-80"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MiniBudgetBar({ used, budget }: { used: number; budget: number }) {
  return (
    <div className="mt-2">
      <BudgetBar used={used} budget={budget || DEFAULT_ENGINE_BUDGET} heightClass="h-1.5" />
    </div>
  );
}

function StackedBar({
  allocations,
  heightClass = "h-5",
}: {
  allocations: BucketAllocation[];
  heightClass?: string;
}) {
  return (
    <div className={`${heightClass} flex overflow-hidden rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg)]`}>
      {allocations
        .filter((allocation) => allocation.tokens > 0)
        .map((allocation) => {
          const meta = bucketMeta(allocation.bucket);
          return (
            <div
              key={allocation.bucket}
              title={`${meta.label}: ${Math.round(allocation.percent)}%`}
              style={{
                width: `${allocation.percent}%`,
                background: meta.color,
                opacity: 0.74,
              }}
            />
          );
        })}
    </div>
  );
}

function BucketRow({
  allocation,
  isSelected,
  onSelect,
}: {
  allocation: BucketAllocation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meta = bucketMeta(allocation.bucket);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "w-full rounded-[2px] border px-3 py-2 text-left transition-colors " +
        (isSelected
          ? "border-[var(--hg-accent)] bg-[var(--hg-accent-tint)]"
          : "border-[var(--hg-line)] bg-[var(--hg-surface)] hover:border-[var(--hg-hairline)]")
      }
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
        <span className="hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)]">
          {meta.label}
        </span>
        <span className="ml-auto hg-mono text-[10px] text-[var(--hg-muted)]">
          {Math.round(allocation.percent)}% · {formatAnalysisTokens(allocation.tokens)}
        </span>
      </div>
    </button>
  );
}

function BucketInsightPanel({
  insight,
  compact = false,
}: {
  insight: BucketInsight;
  compact?: boolean;
}) {
  const meta = bucketMeta(insight.bucket);
  return (
    <section
      className={
        (compact ? "mt-4 " : "") +
        "rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-3"
      }
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
        <span className="hg-section-label">{meta.label} drilldown</span>
        <span className="ml-auto hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-muted)]">
          {Math.round(insight.percent)}%
        </span>
      </div>

      <p className="m-0 text-[12px] leading-[1.5] text-[var(--hg-ink-2)]">{insight.summary}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <InsightMetric label="tightness" value={insight.tightness} />
        <InsightMetric label="signal" value={insight.significance} />
        <InsightMetric label="chunks" value={String(insight.chunks)} />
      </div>

      {!compact && (
        <div className="mt-3 rounded-[2px] border border-dashed border-[var(--hg-hairline)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--hg-muted)]">
          {insight.recurrence.label} · similarity {Math.round(insight.recurrence.similarityScore * 100)}% ·{" "}
          {insight.recurrence.reuseCandidate ? "reuse candidate" : "session-local until reviewed"}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {insight.examples.slice(0, compact ? 3 : 5).map((example) => (
          <div
            key={example.id}
            className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] px-3 py-2"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-ink)] truncate">
                {example.label}
              </span>
              {example.pinned && <span className="hg-pill accent">pinned</span>}
              {example.lineNumber && <span className="hg-pill">line {example.lineNumber}</span>}
              <span className="ml-auto hg-mono text-[9px] text-[var(--hg-muted)]">
                {formatAnalysisTokens(example.tokens)}
              </span>
            </div>
            <div className="text-[12px] leading-[1.45] text-[var(--hg-muted)]">{example.summary}</div>
            <div className="mt-1 hg-mono text-[8px] uppercase tracking-wider text-[var(--hg-muted)]">
              {example.sourceType} · {example.contentHash}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] px-2 py-1.5">
      <div className="hg-mono text-[8px] uppercase tracking-wider text-[var(--hg-muted)]">{label}</div>
      <div className="mt-0.5 hg-mono text-[10px] uppercase tracking-wider text-[var(--hg-ink)]">
        {value}
      </div>
    </div>
  );
}

function PanelEmpty({ label, tone = "muted" }: { label: string; tone?: "muted" | "warn" }) {
  return (
    <div
      className={
        "px-4 py-5 hg-mono text-[10px] uppercase tracking-wider " +
        (tone === "warn" ? "text-[var(--hg-warn)]" : "text-[var(--hg-muted)]")
      }
    >
      {label}
    </div>
  );
}

function WorkbenchShell({
  title,
  meta,
  tone = "muted",
}: {
  title: string;
  meta: string;
  tone?: "muted" | "warn";
}) {
  return (
    <section className="flex-1 min-w-0 flex flex-col bg-[var(--hg-bg)]">
      <div className="px-9 pt-7 pb-5 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)]">
        <h2 className="m-0 hg-mono text-[24px] font-medium tracking-wider uppercase text-[var(--hg-ink)]">
          {title}
        </h2>
        <div
          className={
            "mt-2 hg-mono text-[11px] uppercase tracking-wider " +
            (tone === "warn" ? "text-[var(--hg-warn)]" : "text-[var(--hg-muted)]")
          }
        >
          {meta}
        </div>
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-end gap-2">
      <span>{label}</span>
      <b className="font-medium text-[var(--hg-ink)]">{value}</b>
    </div>
  );
}
