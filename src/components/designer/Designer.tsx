// Designer mode — a workbench for crafting context packages.
//
// The view is split across two roots:
//   - <DesignerChrome /> renders the two SidePanels into the HUD slot.
//   - <DesignerWorkbench /> renders the center-column workbench.
// Both share a `useDesignerState` hook so the active package selection is
// the single source of truth.

import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { SidePanel } from "hudsonkit/chrome";
import { Bot, CheckCircle2, ChevronRight, FlaskConical, Layers, Rocket, Settings } from "lucide-react";

import {
  AGENT_ASSISTED_CONTEXT_DRAFT,
  LOCAL_CONTEXT_RESOURCES,
} from "@/data/contextResourceRepository";
import { PACKAGES, type ContextPackage } from "@/data/packages";
import { MODULE_LIBRARY } from "@/data/modules";
import type { ContextModule } from "@/types";
import { proposeContextDesign } from "@/lib/contextDesignClient";
import {
  profileDraftTokenTotal,
  proposeAgentContextDraft,
  selectedResourcesForDraft,
  type AgentAssistedContextDraft,
  type ContextDesignProposalResponse,
} from "@/lib/contextCreation";
import { fmtTokens, sumTokens } from "@/lib/tokens";

import { PackageList } from "@/components/designer/PackageList";
import { PackageCard } from "@/components/designer/PackageCard";
import { PackageMeta } from "@/components/designer/PackageMeta";

interface DesignerState {
  activeId: string;
  setActiveId: (id: string) => void;
  active: ContextPackage;
  modules: ContextModule[];
}

export function useDesignerState(): DesignerState {
  const [activeId, setActiveId] = useState(PACKAGES[0].id);
  const active = PACKAGES.find((p) => p.id === activeId) ?? PACKAGES[0];
  const modules = useMemo(
    () => active.modules.map((id) => MODULE_LIBRARY[id]).filter(Boolean),
    [active],
  );
  return { activeId, setActiveId, active, modules };
}

interface DesignerChromeProps {
  state: DesignerState;
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onResizeLeft: (e: MouseEvent) => void;
  onResizeRight: (e: MouseEvent) => void;
}

export function DesignerChrome({
  state,
  leftWidth,
  rightWidth,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
  onResizeLeft,
  onResizeRight,
}: DesignerChromeProps) {
  return (
    <>
      <SidePanel
        side="left"
        title="PACKAGES"
        icon={<Layers size={12} className="text-[var(--hg-accent)]" />}
        width={leftWidth}
        onResizeStart={onResizeLeft}
        isCollapsed={leftCollapsed}
        onToggleCollapse={onToggleLeft}
      >
        <PackageList
          packages={PACKAGES}
          activeId={state.activeId}
          onSelect={state.setActiveId}
        />
      </SidePanel>

      <SidePanel
        side="right"
        title="PACKAGE · META"
        icon={<Settings size={12} className="text-[var(--hg-accent)]" />}
        width={rightWidth}
        onResizeStart={onResizeRight}
        isCollapsed={rightCollapsed}
        onToggleCollapse={onToggleRight}
      >
        <PackageMeta pkg={state.active} modules={state.modules} />
      </SidePanel>
    </>
  );
}

export function DesignerWorkbench({
  state,
  onCreateSession,
}: {
  state: DesignerState;
  onCreateSession?: (draft: AgentAssistedContextDraft) => void;
}) {
  const { active: pkg, modules } = state;
  const totalTokens = sumTokens(modules);
  const [objective, setObjective] = useState(AGENT_ASSISTED_CONTEXT_DRAFT.objective);
  const [draft, setDraft] = useState<AgentAssistedContextDraft>(
    AGENT_ASSISTED_CONTEXT_DRAFT,
  );
  const [agentResult, setAgentResult] = useState<ContextDesignProposalResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [isAskingAgent, setIsAskingAgent] = useState(false);
  const [showTestDrive, setShowTestDrive] = useState(true);
  const [designOpen, setDesignOpen] = useState(false);
  const selectedResources = selectedResourcesForDraft(draft, LOCAL_CONTEXT_RESOURCES);
  const testDriveTokens = profileDraftTokenTotal(draft, draft.testDrive.profileId);
  const loadedEvidence = agentResult?.evidence.filter((item) => item.state === "loaded").length ?? 0;
  const agentModeLabel = isAskingAgent
    ? "planning"
    : agentResult?.mode === "agent"
      ? agentResult.model ?? "agent"
      : agentResult?.mode === "heuristic"
        ? "heuristic fallback"
        : "seed draft";

  async function askAgent() {
    setIsAskingAgent(true);
    setAgentError(null);
    try {
      const result = await proposeContextDesign({
        objective,
        target: draft.target,
        profileId: draft.testDrive.profileId,
      });
      setDraft(result.draft);
      setAgentResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextDraft = proposeAgentContextDraft(
        {
          objective,
          target: draft.target,
          profileId: draft.testDrive.profileId,
        },
        LOCAL_CONTEXT_RESOURCES,
      );
      setDraft(nextDraft);
      setAgentResult({
        draft: nextDraft,
        mode: "heuristic",
        generatedAt: new Date().toISOString(),
        evidence: [],
        warnings: [`Agent route unavailable: ${message}`],
      });
      setAgentError(message);
    } finally {
      setIsAskingAgent(false);
      setShowTestDrive(true);
    }
  }

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-[var(--hg-bg)] overflow-auto">
      <div className="flex-shrink-0 px-9 pt-7 pb-4 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)]">
        <div className="flex items-end gap-4 mb-2">
          <h2
            contentEditable
            suppressContentEditableWarning
            className="hg-mono m-0 text-[28px] font-medium tracking-wider uppercase text-[var(--hg-ink)] leading-none border border-dashed border-transparent hover:border-[var(--hg-hairline)] focus:border-[var(--hg-accent)] focus:outline-none rounded-[2px] -mx-2 px-2 py-1 cursor-text"
          >
            {pkg.name}
          </h2>
          <span className="hg-mono text-[11px] text-[var(--hg-muted)] pb-1.5 tracking-wider uppercase">
            {pkg.version} · updated {pkg.updated}
          </span>
          <span className="ml-auto hg-mono text-[11px] text-right text-[var(--hg-muted)] leading-[1.5] tracking-wider uppercase">
            <b className="text-[var(--hg-ink)] font-medium">{modules.length}</b> cards ·{" "}
            <b className="text-[var(--hg-ink)] font-medium">{fmtTokens(totalTokens)}</b> tok
          </span>
        </div>

        <div
          contentEditable
          suppressContentEditableWarning
          className="text-[var(--hg-ink-2)] text-[14px] leading-[1.55] max-w-[640px] mb-1 border border-dashed border-transparent hover:border-[var(--hg-hairline)] focus:border-[var(--hg-accent)] focus:outline-none rounded-[2px] -mx-2 px-2 py-1 cursor-text"
        >
          {pkg.desc}
        </div>

        <div className="flex gap-1.5 items-center flex-wrap mt-3">
          {pkg.tags.map((t) => (
            <span key={t} className="hg-pill">
              #{t}
            </span>
          ))}
          <span className="hg-pill border-dashed cursor-pointer hover:text-[var(--hg-accent)] hover:border-[var(--hg-accent)]">
            + tag
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-[var(--hg-line)] bg-[var(--hg-surface)]">
        <button
          type="button"
          onClick={() => setDesignOpen((open) => !open)}
          aria-expanded={designOpen}
          className="flex w-full items-center gap-2.5 px-9 py-3 hg-mono text-[10px] uppercase tracking-[0.16em] hover:text-[var(--hg-accent)]"
        >
          <ChevronRight
            size={13}
            className={
              "transition-transform " +
              (designOpen ? "rotate-90 text-[var(--hg-accent)]" : "text-[var(--hg-muted)]")
            }
          />
          <Bot size={12} className="text-[var(--hg-accent)]" />
          <span className="text-[var(--hg-ink-2)]">design with agent</span>
          <span className="ml-auto flex items-center gap-2 text-[var(--hg-muted)] normal-case tracking-normal">
            <span>{draft.agent.handle}</span>
            <span>·</span>
            <span>
              {selectedResources.filter((selection) => selection.action !== "drop").length} sources
            </span>
            <span>·</span>
            <span>{fmtTokens(testDriveTokens)} test profile</span>
            <span>·</span>
            <span>{agentModeLabel}</span>
          </span>
        </button>

        {designOpen ? (
          <>
            <div className="border-t border-dashed border-[var(--hg-hairline)] px-9 py-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <label className="sr-only" htmlFor="context-objective">
                    Context objective
                  </label>
                  <textarea
                    id="context-objective"
                    value={objective}
                    onChange={(event) => setObjective(event.currentTarget.value)}
                    className="min-h-[72px] w-full resize-y border border-[var(--hg-line)] bg-[var(--hg-bg)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--hg-ink)] outline-none focus:border-[var(--hg-accent)]"
                  />
                  <div className="mt-2 text-[13px] leading-[1.55] text-[var(--hg-ink-2)] max-w-[880px]">
                    {draft.agent.summary}
                  </div>
                  {agentResult || agentError ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 hg-mono text-[10px] uppercase tracking-[0.12em] text-[var(--hg-muted)]">
                      {agentResult ? (
                        <>
                          <span>{loadedEvidence} loaded resources</span>
                          <span>·</span>
                          <span>{agentResult.warnings.length} warning{agentResult.warnings.length === 1 ? "" : "s"}</span>
                        </>
                      ) : null}
                      {agentError ? (
                        <>
                          <span>·</span>
                          <span className="text-[var(--status-warn-fg)]">route fallback</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={askAgent}
                    disabled={isAskingAgent}
                    className="hg-mono inline-flex h-8 items-center gap-2 border border-[var(--hg-hairline)] px-3 text-[10px] uppercase tracking-[0.12em] text-[var(--hg-ink-2)] hover:border-[var(--hg-accent)] hover:text-[var(--hg-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Bot size={13} />
                    {isAskingAgent ? "asking" : "ask agent"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTestDrive((visible) => !visible)}
                    className="hg-mono inline-flex h-8 items-center gap-2 border border-[var(--hg-hairline)] px-3 text-[10px] uppercase tracking-[0.12em] text-[var(--hg-ink-2)] hover:border-[var(--hg-accent)] hover:text-[var(--hg-accent)]"
                  >
                    <FlaskConical size={13} />
                    test drive
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateSession?.(draft)}
                    className="hg-mono inline-flex h-8 items-center gap-2 border border-[var(--hg-accent)] bg-[var(--hg-accent)]/10 px-3 text-[10px] uppercase tracking-[0.12em] text-[var(--hg-accent)] hover:bg-[var(--hg-accent)]/15 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!onCreateSession}
                  >
                    <Rocket size={13} />
                    create session
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-[var(--hg-hairline)] bg-[var(--hg-bg)] px-9 py-4">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div>
            <div className="hg-mono mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--hg-muted)]">
              agent sculpt
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {selectedResources.map((selection) => (
                <div
                  key={selection.resourceId}
                  className="border border-[var(--hg-line)] bg-[var(--hg-surface)] px-3 py-2"
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`hg-mono text-[10px] uppercase tracking-[0.12em] ${actionTone(selection.action)}`}>
                      {selection.action}
                    </span>
                    <span className="truncate text-[12px] font-medium text-[var(--hg-ink)]">
                      {selection.resource.title}
                    </span>
                    <span className="ml-auto hg-mono text-[10px] text-[var(--hg-muted)]">
                      {fmtTokens(selection.outputTokens)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] leading-[1.45] text-[var(--hg-muted)]">
                    {selection.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showTestDrive ? (
            <div>
              <div className="hg-mono mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--hg-muted)]">
                test drive
              </div>
              <div className="space-y-2">
                {draft.testDrive.checks.map((check) => (
                  <div
                    key={check.id}
                    className="border border-[var(--hg-line)] bg-[var(--hg-surface)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={12} className={toneClass(check.tone)} />
                      <span className={`hg-mono text-[10px] uppercase tracking-[0.12em] ${toneClass(check.tone)}`}>
                        {check.label}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] leading-[1.45] text-[var(--hg-muted)]">
                      {check.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {agentResult ? (
          <div className="mt-5 border-t border-[var(--hg-line)] pt-4">
            <div className="hg-mono mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--hg-muted)]">
              source evidence
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {agentResult.evidence.map((evidence) => (
                <div
                  key={evidence.resourceId}
                  className="border border-[var(--hg-line)] bg-[var(--hg-surface)] px-3 py-2"
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`hg-mono text-[10px] uppercase tracking-[0.12em] ${evidenceTone(evidence.state)}`}>
                      {evidence.state}
                    </span>
                    <span className="truncate text-[12px] font-medium text-[var(--hg-ink)]">
                      {evidence.title}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 hg-mono text-[10px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
                    <span>{formatChars(evidence.chars)}</span>
                    {evidence.contentHash ? <span>{evidence.contentHash}</span> : null}
                  </div>
                  {evidence.note ? (
                    <div className="mt-1 text-[11.5px] leading-[1.45] text-[var(--hg-muted)]">
                      {evidence.note}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex-1 px-9 py-7 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 content-start">
        {modules.map((m: ContextModule) => (
          <PackageCard key={m.id} module={m} />
        ))}
        <button className="border border-dashed border-[var(--hg-hairline)] rounded-[2px] flex flex-col items-center justify-center text-[var(--hg-muted)] min-h-[220px] cursor-pointer hover:text-[var(--hg-accent)] hover:border-[var(--hg-accent)]">
          <div className="hg-mono text-[20px] mb-1">+ new card</div>
          <div className="hg-mono text-[10px] tracking-[0.14em] uppercase">drop · paste · type</div>
        </button>
      </div>
    </section>
  );
}

function actionTone(action: string): string {
  switch (action) {
    case "keep":
      return "text-[var(--status-ok-fg)]";
    case "compress":
      return "text-[var(--hg-ink)]";
    case "refresh":
      return "text-[var(--status-warn-fg)]";
    case "drop":
      return "text-[var(--hg-muted)]";
    default:
      return "text-[var(--hg-muted)]";
  }
}

function toneClass(tone: string): string {
  switch (tone) {
    case "ok":
      return "text-[var(--status-ok-fg)]";
    case "warn":
      return "text-[var(--status-warn-fg)]";
    case "error":
      return "text-[var(--status-error-fg)]";
    default:
      return "text-[var(--hg-muted)]";
  }
}

function evidenceTone(state: string): string {
  switch (state) {
    case "loaded":
      return "text-[var(--status-ok-fg)]";
    case "metadata-only":
      return "text-[var(--status-warn-fg)]";
    case "missing":
      return "text-[var(--status-error-fg)]";
    default:
      return "text-[var(--hg-muted)]";
  }
}

function formatChars(chars: number): string {
  if (chars >= 1000) return `${(chars / 1000).toFixed(1).replace(/\.0$/, "")}k chars`;
  return `${chars} chars`;
}
