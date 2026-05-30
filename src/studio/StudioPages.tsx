"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitFork,
  Gauge,
  PackageOpen,
  RefreshCw,
  Rocket,
  SearchCode,
} from "lucide-react";
import type { ReactNode } from "react";
import { useStudioRouter } from "studio/router";

import {
  HOME_HREF,
  presentations,
  type Presentation,
  type Study,
} from "@/studio/studioRegistry";

const verbs = [
  {
    name: "Explore",
    owner: "Developer-first",
    job: "Inspect native sessions, manifests, docs, and source evidence.",
  },
  {
    name: "Package",
    owner: "Developer-first",
    job: "Curate durable context into versioned, source-backed cartridges.",
  },
  {
    name: "Instantiate",
    owner: "Agent-first",
    job: "Compile a target-specific launch plan and materialized sidecars.",
  },
  {
    name: "Fork",
    owner: "Agent-first",
    job: "Continue from explicit lineage without claiming hidden-state identity.",
  },
];

const covered = [
  "In-flight context control will keep getting harder as providers own more caching, compression, summaries, and memory.",
  "Contextual should move upstream: plan, source, compile, diagnose, instantiate, and fork.",
  "The tool should support the collaborative planning conversation, then preserve its decisions as a cartridge.",
  "Explorer remains useful as evidence and health infrastructure, not the whole destination.",
  "pi-ai gives portable context handoff semantics; pi-coding-agent gives native session tree and fork ergonomics.",
];

const plannerRows = [
  ["Intent", "Help future agents reason about harness context, memory, sessions, forks, replay, and launch profiles."],
  ["Scope", "Claude Code, Codex, OpenCode, pi-ai, pi-coding-agent, Contextual harness docs."],
  ["Targets", "Codex, Claude, pi, and pi-ai first. OpenCode after source coverage improves."],
  ["Evals", "Native vs replay fork, memory boundary, context handoff, source-truth claims."],
];

const loadProfiles = [
  { name: "Briefing", tokens: "4k", use: "Default fresh session load", state: "required" },
  { name: "Working Set", tokens: "15k", use: "Architecture and planning work", state: "recommended" },
  { name: "Deep Pack", tokens: "45k", use: "Implementation or audit work", state: "optional" },
];

const diagnostics = [
  { label: "Efficiency", value: "82", detail: "11% duplication, 6% low signal", tone: "ok" },
  { label: "Freshness", value: "64", detail: "Claude Code and OpenCode need refresh", tone: "warn" },
  { label: "Coverage", value: "71", detail: "OpenCode weak, pi-ai strong", tone: "warn" },
  { label: "Provenance", value: "88", detail: "Most claims source-backed", tone: "ok" },
  { label: "Evals", value: "4/5", detail: "Claude memory boundary failing", tone: "warn" },
];

const sourceState = [
  ["Claude Code", "context, memory, compaction, branch behavior", "stale"],
  ["Codex", "sessions, turn context, harness logs", "fresh"],
  ["OpenCode", "context and session semantics", "missing"],
  ["pi-ai", "portable Context, handoffs, cache affinity", "fresh"],
  ["pi-coding-agent", "native sessions, parentSession, fork tree", "review"],
];

export function NorthStarPage() {
  const { Link } = useStudioRouter();

  return (
    <main className="mx-auto max-w-6xl px-7 py-10 text-studio-ink md:px-10 md:py-14">
      <header className="grid gap-8 border-b border-studio-rule pb-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-studio-ink-faint">
            contextual / north star
          </div>
          <h1 className="mt-4 max-w-[820px] text-[44px] font-medium leading-[1.04] text-studio-ink-strong md:text-[56px]">
            Prepare the next agent session before it starts.
          </h1>
          <p
            className="mt-6 max-w-[68ch] text-[16px] leading-[1.75] text-studio-ink"
            style={{ fontFamily: "var(--studio-font-serif)" }}
          >
            Contextual should not try to outsmart opaque in-flight provider
            context. It should build the durable upstream tooling: source maps,
            cartridges, load profiles, diagnostics, launch plans, and truthful
            forks.
          </p>
        </div>
        <aside className="border-l border-studio-rule pl-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
            durable boundary
          </div>
          <p className="mt-4 text-[20px] leading-[1.35] text-studio-ink-strong">
            Plan, compile, and profile context upstream. Do not pretend to
            control hidden runtime memory downstream.
          </p>
        </aside>
      </header>

      <section className="grid gap-8 border-b border-studio-rule py-10 lg:grid-cols-[280px_1fr]">
        <SectionKicker icon={<Activity size={15} />} label="what we covered" />
        <ol className="divide-y divide-studio-rule border-y border-studio-rule">
          {covered.map((item, index) => (
            <li key={item} className="grid gap-4 py-4 md:grid-cols-[64px_1fr]">
              <span className="font-mono text-[11px] text-studio-ink-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p
                className="max-w-[78ch] text-[15px] leading-[1.7] text-studio-ink"
                style={{ fontFamily: "var(--studio-font-serif)" }}
              >
                {item}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 border-b border-studio-rule py-10 lg:grid-cols-[280px_1fr]">
        <SectionKicker icon={<GitFork size={15} />} label="operating split" />
        <div className="grid gap-px bg-studio-rule md:grid-cols-2">
          {verbs.map((verb) => (
            <div key={verb.name} className="bg-studio-canvas p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[22px] font-medium leading-none text-studio-ink-strong">
                  {verb.name}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
                  {verb.owner}
                </span>
              </div>
              <p
                className="mt-4 text-[14px] leading-[1.65] text-studio-ink"
                style={{ fontFamily: "var(--studio-font-serif)" }}
              >
                {verb.job}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 py-10 lg:grid-cols-[280px_1fr]">
        <SectionKicker icon={<FileText size={15} />} label="presentations" />
        <div>
          <ul className="divide-y divide-studio-rule border-y border-studio-rule">
            {presentations.map((presentation) => (
              <li key={presentation.id}>
                <Link
                  href={presentation.href}
                  className="group grid gap-3 py-4 transition-colors hover:bg-studio-chip-bg md:grid-cols-[96px_1fr_20px]"
                >
                  <span className="font-mono text-[11px] tracking-[0.08em] text-studio-ink-faint group-hover:text-studio-ink-strong">
                    {presentation.id}
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-studio-ink-strong">
                      {presentation.title}
                    </span>
                    <span
                      className="mt-1 block max-w-[72ch] text-[12.5px] leading-[1.55] text-studio-ink-faint"
                      style={{ fontFamily: "var(--studio-font-serif)" }}
                    >
                      {presentation.summary}
                    </span>
                  </span>
                  <ArrowRight
                    size={15}
                    className="self-center text-studio-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-studio-ink"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

export function PresentationPage({ presentation }: { presentation: Presentation }) {
  const { Link } = useStudioRouter();

  return (
    <main className="mx-auto max-w-6xl px-7 py-10 text-studio-ink md:px-10 md:py-14">
      <header className="border-b border-studio-rule pb-9">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-studio-ink-faint">
          {presentation.id}
        </div>
        <h1 className="mt-4 max-w-[860px] text-[40px] font-medium leading-[1.05] text-studio-ink-strong md:text-[52px]">
          {presentation.title}
        </h1>
        <p
          className="mt-5 max-w-[72ch] text-[17px] leading-[1.7] text-studio-ink"
          style={{ fontFamily: "var(--studio-font-serif)" }}
        >
          {presentation.thesis}
        </p>
      </header>

      <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-9">
          {presentation.sections.map((section) => (
            <section key={section.title} className="border-t border-studio-rule pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
                {section.eyebrow}
              </div>
              <h2 className="mt-3 text-[26px] font-medium leading-tight text-studio-ink-strong">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4">
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="max-w-[78ch] text-[15px] leading-[1.75] text-studio-ink"
                    style={{ fontFamily: "var(--studio-font-serif)" }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.bullets ? (
                <ul className="mt-5 divide-y divide-studio-rule border-y border-studio-rule">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 py-3 text-[13.5px] leading-relaxed text-studio-ink">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[var(--status-ok-fg)]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <aside className="space-y-7">
          <div className="border-l border-studio-rule pl-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
              source
            </div>
            <ul className="mt-3 space-y-2">
              {presentation.source.map((source) => (
                <li key={source}>
                  <code className="text-[11px] text-studio-ink">{source}</code>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-l border-studio-rule pl-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
              next
            </div>
            <ul className="mt-3 space-y-3">
              {presentation.next.map((item) => (
                <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-studio-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-scout-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={HOME_HREF}
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint hover:text-studio-ink"
          >
            <ArrowRight size={13} className="rotate-180" />
            North Star
          </Link>
        </aside>
      </div>
    </main>
  );
}

export function StudyPage({ study }: { study: Study }) {
  if (study.slug === "planner-workbench") return <PlannerStudyPage study={study} />;
  if (study.slug === "health-console") return <HealthStudyPage study={study} />;
  return <NotFoundPage />;
}

function PlannerStudyPage({ study }: { study: Study }) {
  return (
    <main className="mx-auto max-w-6xl px-7 py-10 text-studio-ink md:px-10 md:py-14">
      <StudyHeader study={study} icon={<ClipboardList size={16} />} />
      <section className="grid gap-6 py-9 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border-y border-studio-rule">
          {plannerRows.map(([label, value]) => (
            <div key={label} className="grid gap-4 border-b border-studio-rule py-5 last:border-b-0 md:grid-cols-[140px_1fr]">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-studio-ink-faint">
                {label}
              </div>
              <div
                className="max-w-[76ch] text-[15px] leading-[1.7] text-studio-ink"
                style={{ fontFamily: "var(--studio-font-serif)" }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
        <aside className="border-l border-studio-rule pl-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
            load profiles
          </div>
          <ul className="mt-4 divide-y divide-studio-rule border-y border-studio-rule">
            {loadProfiles.map((profile) => (
              <li key={profile.name} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium text-studio-ink-strong">
                    {profile.name}
                  </span>
                  <span className="font-mono text-[11px] text-scout-accent">
                    {profile.tokens}
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-studio-ink-faint">
                  {profile.use}
                </p>
                <span className="mt-3 inline-flex font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
                  {profile.state}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}

function HealthStudyPage({ study }: { study: Study }) {
  return (
    <main className="mx-auto max-w-6xl px-7 py-10 text-studio-ink md:px-10 md:py-14">
      <StudyHeader study={study} icon={<Gauge size={16} />} />
      <section className="grid gap-8 py-9 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-px bg-studio-rule sm:grid-cols-2 xl:grid-cols-3">
          {diagnostics.map((item) => (
            <MetricTile key={item.label} item={item} />
          ))}
        </div>
        <aside className="border-l border-studio-rule pl-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
            <RefreshCw size={14} />
            rebuild recommendation
          </div>
          <p
            className="mt-4 text-[14px] leading-[1.7] text-studio-ink"
            style={{ fontFamily: "var(--studio-font-serif)" }}
          >
            Do not recreate. Refresh Claude Code and OpenCode sources, then
            recompile context models and warnings. Keep pi-ai and Codex sections
            unchanged.
          </p>
          <div className="mt-7 border-t border-studio-rule pt-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-studio-ink-faint">
              source state
            </div>
            <ul className="mt-3 space-y-3">
              {sourceState.map(([name, detail, state]) => (
                <li key={name} className="grid grid-cols-[88px_1fr_auto] gap-3 text-[12px]">
                  <span className="font-medium text-studio-ink-strong">{name}</span>
                  <span className="text-studio-ink-faint">{detail}</span>
                  <span className="font-mono uppercase tracking-[0.14em] text-studio-ink-faint">
                    {state}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}

export function NotFoundPage() {
  const { Link } = useStudioRouter();
  return (
    <main className="mx-auto max-w-3xl px-7 py-16 text-studio-ink md:px-10">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-studio-ink-faint">
        contextual studio
      </div>
      <h1 className="mt-4 text-[36px] font-medium text-studio-ink-strong">
        Page not found.
      </h1>
      <Link
        href={HOME_HREF}
        className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint hover:text-studio-ink"
      >
        <ArrowRight size={13} className="rotate-180" />
        North Star
      </Link>
    </main>
  );
}

function StudyHeader({ study, icon }: { study: Study; icon: ReactNode }) {
  return (
    <header className="border-b border-studio-rule pb-8">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-studio-ink-faint">
        {icon}
        design study
      </div>
      <h1 className="mt-4 text-[40px] font-medium leading-tight text-studio-ink-strong md:text-[52px]">
        {study.title}
      </h1>
      <p
        className="mt-4 max-w-[64ch] text-[16px] leading-[1.7] text-studio-ink"
        style={{ fontFamily: "var(--studio-font-serif)" }}
      >
        {study.summary}
      </p>
    </header>
  );
}

function SectionKicker({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 self-start font-mono text-[10px] uppercase tracking-[0.24em] text-studio-ink-faint">
      {icon}
      {label}
    </div>
  );
}

function MetricTile({ item }: { item: (typeof diagnostics)[number] }) {
  const ok = item.tone === "ok";
  return (
    <div className="bg-studio-canvas p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-studio-ink-faint">
          {item.label}
        </span>
        {ok ? (
          <CheckCircle2 size={14} className="text-[var(--status-ok-fg)]" />
        ) : (
          <AlertTriangle size={14} className="text-[var(--status-warn-fg)]" />
        )}
      </div>
      <div className="mt-5 text-[34px] font-medium leading-none text-studio-ink-strong">
        {item.value}
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-studio-ink-faint">
        {item.detail}
      </p>
    </div>
  );
}

export const presentationIcons = {
  "CTH-001": SearchCode,
  "CTH-002": PackageOpen,
  "CTH-003": ClipboardList,
  "CTH-004": Gauge,
  "CTH-005": Rocket,
};
