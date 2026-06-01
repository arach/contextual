"use client";

import { Bot, CheckCircle2, FlaskConical, Rocket } from "lucide-react";
import type { ReactNode } from "react";
import { CodeViewer } from "studio/code";
import { useStudioRouter } from "studio/router";

import {
  AGENT_ASSISTED_CONTEXT_DRAFT,
  LOCAL_CONTEXT_RESOURCES,
} from "@/data/contextResourceRepository";
import {
  buildDesignedSession,
  compileContextPrompt,
  profileDraftTokenTotal,
  resourcesForDraft,
  selectedResourcesForDraft,
  type AgentResourceAction,
  type ContextDraftPart,
  type ContextTestDriveCheck,
} from "@/lib/contextCreation";
import type { HealthTone } from "@/lib/contextCartridge";
import { fmtTokens } from "@/lib/tokens";
import {
  CONTEXT_DESIGNER_HREF,
  type ContextDesignerRoute,
} from "@/studio/studioRegistry";

const draft = AGENT_ASSISTED_CONTEXT_DRAFT;

export function ContextDesignerPage({ route }: { route: ContextDesignerRoute }) {
  const { Link } = useStudioRouter();
  const resources = resourcesForDraft(draft, LOCAL_CONTEXT_RESOURCES);
  const selected = selectedResourcesForDraft(draft, LOCAL_CONTEXT_RESOURCES);
  const selectedTokens = selected.reduce((total, selection) => total + selection.outputTokens, 0);

  return (
    <main className="max-w-6xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <DesignerHeader route={route} />

      <Section label="Study Snapshot">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint">
              <Bot size={13} />
              <span>{draft.agent.handle}</span>
              <span>·</span>
              <span>{draft.target}</span>
            </div>
            <p className="mt-3 max-w-[78ch] text-[13.5px] leading-[1.65] text-studio-ink">
              {draft.agent.summary}
            </p>
            <p className="mt-4 max-w-[78ch] text-[12.5px] leading-[1.6] text-studio-ink-faint">
              {draft.agent.instruction}
            </p>
          </div>
          <div className="border-l border-studio-rule pl-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint">
              static draft
            </div>
            <dl className="mt-3 space-y-2 text-[12px]">
              <MetaRow label="Resources" value={String(resources.length)} />
              <MetaRow label="Selected" value={String(selected.length)} />
              <MetaRow label="Output" value={fmtTokens(selectedTokens)} />
              <MetaRow
                label="Profile"
                value={`${draft.testDrive.profileId} / ${fmtTokens(profileDraftTokenTotal(draft, draft.testDrive.profileId))}`}
              />
            </dl>
            <Link
              href={`${CONTEXT_DESIGNER_HREF}/test-drive`}
              className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint hover:text-studio-ink"
            >
              <FlaskConical size={13} />
              Test drive
            </Link>
          </div>
        </div>
      </Section>

      <Section label="Local Resource Repo">
        <ResourceTable />
      </Section>

      <Section label="Agent Sculpt">
        <div className="-mx-3">
          <div className="grid gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint md:grid-cols-[120px_180px_1fr_90px]">
            <span>Action</span>
            <span>Slot</span>
            <span>Resource and reason</span>
            <span>Output</span>
          </div>
          <ul className="flex flex-col border-t border-studio-rule">
            {selectedResourcesForDraft(draft, LOCAL_CONTEXT_RESOURCES).map((selection) => (
              <li
                key={selection.resourceId}
                className="grid gap-4 px-3 py-2.5 md:grid-cols-[120px_180px_1fr_90px]"
              >
                <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${actionTone(selection.action)}`}>
                  {selection.action}
                </span>
                <span className="font-mono text-[11px] text-studio-ink-faint">
                  {selection.slot}
                </span>
                <span>
                  <span className="block text-[13px] text-studio-ink-strong">
                    {selection.resource.title}
                  </span>
                  <span className="mt-1 block text-[12px] leading-[1.55] text-studio-ink-faint">
                    {selection.reason}
                  </span>
                </span>
                <span className="text-right font-mono text-[11px] text-studio-ink">
                  {fmtTokens(selection.outputTokens)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section label="Compiled Parts">
        <ul className="flex flex-col border-t border-studio-rule">
          {draft.parts.map((part) => (
            <PartRow key={part.id} part={part} />
          ))}
        </ul>
      </Section>
    </main>
  );
}

export function ContextTestDrivePage({ route }: { route: ContextDesignerRoute }) {
  const session = buildDesignedSession(draft, {
    now: "2026-06-01T12:00:00-04:00",
    profileId: draft.testDrive.profileId,
  });
  const prompt = compileContextPrompt(draft, draft.testDrive.profileId);

  return (
    <main className="max-w-6xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <DesignerHeader route={route} />

      <Section label="Dry Run">
        <div className="grid gap-5 md:grid-cols-4">
          {draft.testDrive.checks.map((check) => (
            <CheckTile key={check.id} check={check} />
          ))}
        </div>
      </Section>

      <Section label="Scenarios">
        <ul className="flex flex-col border-t border-studio-rule">
          {draft.testDrive.scenarios.map((scenario) => (
            <li
              key={scenario.id}
              className="grid gap-4 px-3 py-3 md:grid-cols-[100px_1fr_1fr]"
            >
              <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${resultTone(scenario.result)}`}>
                {scenario.result}
              </span>
              <span>
                <span className="block text-[13px] text-studio-ink-strong">
                  {scenario.prompt}
                </span>
                <span className="mt-1 block text-[12px] leading-[1.55] text-studio-ink-faint">
                  {scenario.notes}
                </span>
              </span>
              <span className="text-[12px] leading-[1.55] text-studio-ink-faint">
                {scenario.expectedSignals.join(" / ")}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Compiled Prompt">
        <CodeViewer
          filename={`${draft.id}-${draft.testDrive.profileId}.md`}
          content={prompt}
          themeDetection={{ mode: "data-attribute", attr: "data-theme", lightValue: "light" }}
          className="overflow-hidden border border-studio-rule"
        />
      </Section>

      <Section label="Example Session Record">
        <CodeViewer
          filename={`${session.thread.id}.json`}
          content={JSON.stringify(session, null, 2)}
          themeDetection={{ mode: "data-attribute", attr: "data-theme", lightValue: "light" }}
          className="overflow-hidden border border-studio-rule"
        />
      </Section>
    </main>
  );
}

function DesignerHeader({ route }: { route: ContextDesignerRoute }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
        <Rocket size={13} />
        <span>{route.kind}</span>
        <span className="text-studio-ink-faint/60">·</span>
        <span>{route.status}</span>
      </div>
      <h1 className="mt-3 max-w-[860px] text-[28px] font-medium leading-[1.15] text-studio-ink-strong md:text-[36px]">
        {route.title}
      </h1>
      <p className="mt-4 max-w-[76ch] text-[15px] leading-[1.7] text-studio-ink">
        {route.summary}
      </p>
    </header>
  );
}

function ResourceTable() {
  return (
    <div className="-mx-3">
      <div className="grid gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint md:grid-cols-[1fr_1fr_130px]">
        <span>Resource</span>
        <span>Use</span>
        <span>Status</span>
      </div>
      <ul className="flex flex-col border-t border-studio-rule">
        {LOCAL_CONTEXT_RESOURCES.map((resource) => (
          <li
            key={resource.id}
            className="grid gap-4 px-3 py-2.5 md:grid-cols-[1fr_1fr_130px]"
          >
            <span>
              <span className="block text-[13px] text-studio-ink-strong">
                {resource.title}
              </span>
              <code className="mt-1 block text-[11px] text-studio-ink-faint">
                {resource.path}
              </code>
            </span>
            <span className="text-[12px] leading-[1.55] text-studio-ink-faint">
              {resource.usefulFor}
            </span>
            <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${sourceTone(resource.state)}`}>
              {resource.state} / {resource.truth}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PartRow({ part }: { part: ContextDraftPart }) {
  return (
    <li className="grid gap-4 px-3 py-3 md:grid-cols-[160px_1fr_110px]">
      <span>
        <span className="block text-[13px] font-medium text-studio-ink-strong">
          {part.title}
        </span>
        <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-studio-ink-faint">
          {part.slot} / {part.truth}
        </span>
      </span>
      <span>
        <span className="block text-[12.5px] leading-[1.55] text-studio-ink">
          {part.body}
        </span>
        <span className="mt-1 block font-mono text-[10.5px] text-studio-ink-faint">
          {part.sourceIds.join(", ")}
        </span>
      </span>
      <span className="text-right font-mono text-[11px] text-studio-ink-faint">
        {fmtTokens(part.tokens)}
      </span>
    </li>
  );
}

function CheckTile({ check }: { check: ContextTestDriveCheck }) {
  return (
    <div className="border-t border-studio-rule pt-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={13} className={toneClass(check.tone)} />
        <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${toneClass(check.tone)}`}>
          {check.label}
        </span>
      </div>
      <p className="mt-3 text-[12px] leading-[1.55] text-studio-ink-faint">
        {check.detail}
      </p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="font-mono uppercase tracking-[0.12em] text-studio-ink-faint">
        {label}
      </dt>
      <dd className="font-mono text-studio-ink">{value}</dd>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-10 border-t border-studio-rule pt-6">
      <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-studio-ink-faint">
        {label}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function sourceTone(state: string): string {
  switch (state) {
    case "fresh":
      return "text-[var(--status-ok-fg)]";
    case "stale":
      return "text-[var(--status-warn-fg)]";
    case "missing":
      return "text-[var(--status-error-fg)]";
    default:
      return "text-studio-ink";
  }
}

function actionTone(action: AgentResourceAction): string {
  switch (action) {
    case "keep":
      return "text-[var(--status-ok-fg)]";
    case "compress":
      return "text-studio-ink";
    case "refresh":
      return "text-[var(--status-warn-fg)]";
    case "drop":
      return "text-studio-ink-faint";
  }
}

function toneClass(tone: HealthTone): string {
  switch (tone) {
    case "ok":
      return "text-[var(--status-ok-fg)]";
    case "warn":
      return "text-[var(--status-warn-fg)]";
    case "error":
      return "text-[var(--status-error-fg)]";
    default:
      return "text-studio-ink";
  }
}

function resultTone(result: string): string {
  switch (result) {
    case "pass":
      return "text-[var(--status-ok-fg)]";
    case "warn":
      return "text-[var(--status-warn-fg)]";
    case "fail":
      return "text-[var(--status-error-fg)]";
    default:
      return "text-studio-ink";
  }
}
