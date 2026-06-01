"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Gauge,
  PackageOpen,
  Rocket,
  SearchCode,
} from "lucide-react";
import type { ReactNode } from "react";
import { CodeViewer } from "studio/code";
import { DataRow, EngDocSheet, EngMarkdown } from "studio/doc";
import { useStudioRouter } from "studio/router";

import { CONTEXT_CARTRIDGES } from "@/data/contextCartridges";
import {
  cartridgeById,
  partsForProfile,
  planRecord,
  profileTokenTotal,
  type CartridgePart,
  type CartridgePlan,
  type ContextCartridge,
  type CoverageRow,
  type HealthMetric,
  type HealthTone,
  type LoadProfileId,
  type PlannerDecisionKind,
  type SourceState,
  type TruthState,
} from "@/lib/contextCartridge";
import { fmtTokens } from "@/lib/tokens";
import type { CtxDoc } from "@/studio/ctxDocs";
import {
  CARTRIDGES_HREF,
  HOME_HREF,
  cartridgeRoutes,
  contextDesignerRoutes,
  statusPalette,
  type CartridgeRoute,
  type PresentationRef,
  type Study,
} from "@/studio/studioRegistry";

const SHEET_FRAME =
  "-mx-7 border-y border-studio-edge bg-studio-canvas md:-mx-10 " +
  "[&>div>*]:!px-7 md:[&>div>*]:!px-10 " +
  "[&>div>*+*]:border-t [&>div>*+*]:border-studio-rule";

const verbs = [
  {
    name: "Explore",
    owner: "For people",
    job: "Look at sessions, manifests, docs, and source files.",
  },
  {
    name: "Package",
    owner: "For people",
    job: "Bundle context into versioned cartridges, with sources attached.",
  },
  {
    name: "Instantiate",
    owner: "For agents",
    job: "Compile a launch plan for a specific target. Materialize sidecars.",
  },
  {
    name: "Fork",
    owner: "For agents",
    job: "Continue from a known parent. Don't fake continuity.",
  },
];

const organizingPrinciples = [
  ["Plan before launch", "Decide what the starting context is before the agent runs."],
  ["Files over chat", "Save planning conversations as cartridges, plans, evals, and records."],
  ["Sources stay separate from notes", "Keep logged, reconstructed, inferred, and manual content distinguishable."],
  ["Profiles, not monoliths", "Briefing, working set, deep pack. Different jobs need different loads."],
  ["Check before launch", "Efficiency, freshness, coverage, provenance, evals. Then keep, refresh, rebuild, or block."],
  ["Label every fork", "Native, replay, recipe-derived, or manual. Don't blur the line."],
];

export function NorthStarPage({
  presentations,
}: {
  presentations: readonly PresentationRef[];
}) {
  const { Link } = useStudioRouter();

  return (
    <main className="max-w-5xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <header>
        <h1 className="max-w-[640px] text-[20px] font-medium leading-[1.3] text-studio-ink-strong md:text-[22px]">
          Set up the context before the session starts.
        </h1>
        <p className="mt-3 max-w-[64ch] text-[13px] leading-[1.65] text-studio-ink-faint">
          Contextual plans what an agent starts with. It doesn't try to manage
          what happens inside the model — that's the provider's job.
          The main app is the product; Studio is where proposals and studies
          are made legible before they graduate.
        </p>
      </header>

      <Section label="Principles">
        <ul className="flex flex-col gap-1.5">
          {organizingPrinciples.map(([title, detail]) => (
            <li key={title} className="text-[12.5px] leading-[1.55]">
              <span className="text-studio-ink-strong">{title}.</span>{" "}
              <span className="text-studio-ink-faint">{detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Four operations">
        <ul className="flex flex-col gap-1.5">
          {verbs.map((verb) => (
            <li key={verb.name} className="text-[12.5px] leading-[1.55]">
              <span className="text-studio-ink-strong">{verb.name}.</span>{" "}
              <span className="text-studio-ink-faint">{verb.job}</span>
              <span className="ml-2 font-mono text-[10.5px] text-studio-ink-faint/70">
                ({verb.owner.toLowerCase()})
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Studio experiments">
        <ul className="-mx-3 flex flex-col">
          {contextDesignerRoutes.map((route) => (
            <li key={route.href}>
              <Link
                href={route.href}
                className="group grid gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-studio-chip-bg md:grid-cols-[140px_1fr_20px]"
              >
                <span className="font-mono text-[11px] text-studio-ink-faint group-hover:text-studio-ink">
                  {route.kind}
                </span>
                <span>
                  <span className="block text-[14px] text-studio-ink-strong">
                    {route.title}
                  </span>
                  <span className="mt-1 block max-w-[72ch] text-[12.5px] leading-[1.55] text-studio-ink-faint">
                    {route.summary}
                  </span>
                </span>
                <ArrowRight
                  size={14}
                  className="self-center text-studio-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-studio-ink"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Cartridges">
        <ul className="-mx-3 flex flex-col">
          {cartridgeRoutes.map((route) => (
            <li key={route.href}>
              <Link
                href={route.href}
                className="group grid gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-studio-chip-bg md:grid-cols-[140px_1fr_20px]"
              >
                <span className="font-mono text-[11px] text-studio-ink-faint group-hover:text-studio-ink">
                  {route.kind}
                </span>
                <span>
                  <span className="block text-[14px] text-studio-ink-strong">
                    {route.title}
                  </span>
                  <span className="mt-1 block max-w-[72ch] text-[12.5px] leading-[1.55] text-studio-ink-faint">
                    {route.summary}
                  </span>
                </span>
                <ArrowRight
                  size={14}
                  className="self-center text-studio-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-studio-ink"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Presentations">
        <ul className="-mx-3 flex flex-col">
          {presentations.map((presentation) => (
            <li key={presentation.id}>
              <Link
                href={presentation.href}
                className="group grid gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-studio-chip-bg md:grid-cols-[80px_1fr_20px]"
              >
                <span className="font-mono text-[11px] text-studio-ink-faint group-hover:text-studio-ink">
                  {presentation.id}
                </span>
                <span>
                  <span className="block text-[14px] text-studio-ink-strong">
                    {presentation.title}
                  </span>
                  <span className="mt-1 block max-w-[72ch] text-[12.5px] leading-[1.55] text-studio-ink-faint">
                    {presentation.summary}
                  </span>
                </span>
                <ArrowRight
                  size={14}
                  className="self-center text-studio-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-studio-ink"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

export function PresentationPage({ doc }: { doc: CtxDoc }) {
  return (
    <main className="max-w-[820px] px-7 pt-5 pb-20 text-studio-ink md:px-10 md:pt-6">
      <PresentationHeaderSheet doc={doc} />

      <div className="mt-8">
        <EngMarkdown
          body={doc.body}
          fromSlug={doc.slug}
          buildFileHref={(path) => `/${path}`}
        />
      </div>

      <PresentationColophon doc={doc} />
    </main>
  );
}

const SHEET_LABEL_WIDTH = 96;

function PresentationHeaderSheet({ doc }: { doc: CtxDoc }) {
  const { StatusPill } = statusPalette;
  return (
    <EngDocSheet className={SHEET_FRAME}>
      <DataRow label="Note" labelWidth={SHEET_LABEL_WIDTH}>
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-studio-ink-strong">
          {doc.id}
        </span>
      </DataRow>

      <DataRow label="Status" labelWidth={SHEET_LABEL_WIDTH}>
        <div className="flex flex-wrap items-baseline gap-2.5">
          <StatusPill status={doc.status} variant="outlined" />
          {doc.statusRaw ? (
            <span className="font-mono text-[10.5px] text-studio-ink-faint">
              {doc.statusRaw}
            </span>
          ) : null}
        </div>
      </DataRow>

      <DataRow label="Title" labelWidth={SHEET_LABEL_WIDTH}>
        <h1 className="m-0 text-[24px] font-medium leading-[1.15] tracking-tight text-studio-ink-strong">
          {doc.title}
        </h1>
      </DataRow>

      {doc.headerSections.map((section) => (
        <DataRow
          key={section.label}
          label={section.label}
          labelWidth={SHEET_LABEL_WIDTH}
        >
          <EngMarkdown body={section.body} fromSlug={doc.slug} compact />
        </DataRow>
      ))}
    </EngDocSheet>
  );
}

function PresentationColophon({ doc }: { doc: CtxDoc }) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (doc.owner) {
    rows.push({
      label: "Owner",
      value: (
        <span className="font-mono text-[11px] text-studio-ink">{doc.owner}</span>
      ),
    });
  }
  if (doc.lastUpdated) {
    rows.push({
      label: "Updated",
      value: (
        <span className="font-mono text-[11px] text-studio-ink">
          {doc.lastUpdated}
        </span>
      ),
    });
  }
  for (const x of doc.extraMeta) {
    rows.push({
      label: x.label,
      value: <span className="text-[12px] text-studio-ink">{x.value}</span>,
    });
  }
  rows.push({
    label: "Source",
    value: (
      <code className="font-mono text-[10.5px] text-studio-ink-faint">
        {doc.source}
      </code>
    ),
  });

  return (
    <EngDocSheet className={`mt-14 ${SHEET_FRAME}`}>
      {rows.map((row) => (
        <DataRow key={row.label} label={row.label} labelWidth={SHEET_LABEL_WIDTH}>
          {row.value}
        </DataRow>
      ))}
    </EngDocSheet>
  );
}

export function CartridgePage({ route }: { route: CartridgeRoute }) {
  if (route.kind === "index") return <CartridgeIndexPage />;

  const cartridge = cartridgeById(CONTEXT_CARTRIDGES, route.cartridgeId ?? "");
  if (!cartridge) return <NotFoundPage />;

  switch (route.kind) {
    case "detail":
      return <CartridgeDetailPage cartridge={cartridge} />;
    case "planner":
      return <CartridgePlannerPage cartridge={cartridge} />;
    case "health":
      return <CartridgeHealthPage cartridge={cartridge} />;
    case "launch":
      return <CartridgePlanPage cartridge={cartridge} plan={cartridge.plans.launch} />;
    case "fork":
      return <CartridgePlanPage cartridge={cartridge} plan={cartridge.plans.fork} />;
  }
}

function CartridgeIndexPage() {
  const { Link } = useStudioRouter();

  return (
    <main className="max-w-5xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <header>
        <h1 className="text-[28px] font-medium leading-[1.15] text-studio-ink-strong md:text-[36px]">
          Cartridges
        </h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-[1.7] text-studio-ink">
          A cartridge holds everything an agent needs to start: intent,
          sources, parts, profiles, health, evals, and a launch or fork
          preview.
        </p>
      </header>

      <Section label="Registry">
        <div className="-mx-3">
          <div className="grid grid-cols-[220px_1fr_100px_80px] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
            <span>ID</span>
            <span>Name</span>
            <span>State</span>
            <span>Version</span>
          </div>
          <ul className="flex flex-col border-t border-studio-rule">
            {CONTEXT_CARTRIDGES.map((cartridge) => (
              <li key={cartridge.id}>
                <Link
                  href={`${CARTRIDGES_HREF}/${cartridge.id}`}
                  className="group grid grid-cols-[220px_1fr_100px_80px] items-baseline gap-4 rounded-md px-3 py-3 transition-colors hover:bg-studio-chip-bg"
                >
                  <span className="font-mono text-[12px] text-studio-ink group-hover:text-studio-ink-strong">
                    {cartridge.id}
                  </span>
                  <span>
                    <span className="block text-[14px] text-studio-ink-strong">
                      {cartridge.name}
                    </span>
                    <span className="mt-1 block max-w-[68ch] text-[12.5px] leading-[1.55] text-studio-ink-faint">
                      {cartridge.intent}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-studio-ink-faint">
                    {cartridge.lifecycle}
                  </span>
                  <span className="font-mono text-[11px] text-studio-ink-faint">
                    {cartridge.version}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </main>
  );
}

function CartridgeDetailPage({ cartridge }: { cartridge: ContextCartridge }) {
  return (
    <main className="max-w-6xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <CartridgeHeader cartridge={cartridge} eyebrow={`cartridge / ${cartridge.id}`} />

      <Section label="Goals">
        <ul className="grid gap-2 md:grid-cols-2">
          {cartridge.objectives.map((objective) => (
            <li key={objective} className="text-[13px] leading-[1.6] text-studio-ink">
              — {objective}
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Sources">
        <SourceTable cartridge={cartridge} />
      </Section>

      <Section label="Parts">
        <TokenStrip cartridge={cartridge} profileId="working-set" />
        <ul className="mt-4 flex flex-col gap-3">
          {cartridge.parts.map((part) => (
            <PartRow key={part.id} part={part} />
          ))}
        </ul>
      </Section>

      <Section label="Load profiles">
        <ProfileGrid cartridge={cartridge} />
      </Section>

      <Section label="Evals">
        <EvalTable cartridge={cartridge} />
      </Section>

      <Section label="History">
        <ul className="flex flex-col">
          {cartridge.history.map((entry) => (
            <li
              key={entry.version}
              className="grid items-baseline gap-4 py-2 md:grid-cols-[80px_140px_1fr]"
            >
              <span className="font-mono text-[12px] text-studio-ink-strong">
                {entry.version}
              </span>
              <span className="font-mono text-[11px] text-studio-ink-faint">
                {entry.author} · {entry.when.slice(0, 10)}
              </span>
              <span className="text-[13px] leading-[1.55] text-studio-ink">
                {entry.note}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function CartridgePlannerPage({ cartridge }: { cartridge: ContextCartridge }) {
  return (
    <main className="max-w-6xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <CartridgeHeader cartridge={cartridge} eyebrow="planner" />

      <Section label="Stages">
        <div className="-mx-3">
          <div className="grid grid-cols-[40px_1fr_140px] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
            <span>#</span>
            <span>Stage</span>
            <span>Status</span>
          </div>
          <ul className="flex flex-col border-t border-studio-rule">
            {cartridge.planner.map((stage, index) => (
              <li
                key={stage.id}
                className="grid items-baseline gap-4 px-3 py-2 md:grid-cols-[40px_1fr_140px]"
              >
                <span className="font-mono text-[11px] text-studio-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] font-medium text-studio-ink-strong">
                  {stage.label}
                </span>
                <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${plannerStatusTone(stage.status)}`}>
                  {stage.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {cartridge.planner.map((stage, index) => (
        <Section key={stage.id} label={`${String(index + 1).padStart(2, "0")} · ${stage.label}`}>
          <h2 className="text-[18px] font-medium leading-snug text-studio-ink-strong">
            {stage.title}
          </h2>
          <p className="mt-2 max-w-[72ch] text-[14px] leading-[1.65] text-studio-ink">
            {stage.charter}
          </p>

          <div className="mt-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
              Proposal · {stage.proposal.author} · v{stage.proposal.version}
            </div>
            <p className="mt-2 max-w-[78ch] text-[13px] leading-[1.6] text-studio-ink">
              {stage.proposal.summary}
            </p>
          </div>

          {stage.decisions.length > 0 ? (
            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
                Decisions
              </div>
              <ul className="mt-2 flex flex-col gap-2">
                {stage.decisions.map((decision) => (
                  <li key={decision.id} className="text-[12.5px] leading-[1.55] text-studio-ink">
                    <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${plannerDecisionTone(decision.kind)}`}>
                      {decision.kind}
                    </span>
                    <span className="ml-2 text-studio-ink">— {decision.reason}</span>
                    <span className="ml-2 font-mono text-[10.5px] text-studio-ink-faint">
                      {decision.author} · {decision.createdAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ))}
    </main>
  );
}

function plannerStatusTone(status: string): string {
  switch (status) {
    case "accepted": return "text-[var(--status-ok-fg)]";
    case "proposed": return "text-studio-ink";
    case "blocked": return "text-[var(--status-error-fg)]";
    default: return "text-studio-ink-faint";
  }
}

function plannerDecisionTone(kind: PlannerDecisionKind): string {
  switch (kind) {
    case "accept": return "text-[var(--status-ok-fg)]";
    case "defer": return "text-[var(--status-warn-fg)]";
    case "edit": return "text-studio-ink";
    case "omit": return "text-studio-ink-faint";
  }
}

function CartridgeHealthPage({ cartridge }: { cartridge: ContextCartridge }) {
  const rec = cartridge.health.recommendation;
  return (
    <main className="max-w-6xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <CartridgeHeader cartridge={cartridge} eyebrow="health" />

      <Section label="Recommendation">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className={`font-mono text-[14px] uppercase tracking-[0.1em] ${recommendationTone(rec.kind)}`}>
            {rec.label}
          </span>
          {rec.actions.length > 0 ? (
            <span className="font-mono text-[11px] text-studio-ink-faint">
              · {rec.actions.join("  ·  ")}
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-[78ch] text-[14px] leading-[1.65] text-studio-ink">
          {rec.why}
        </p>
      </Section>

      <Section label="Metrics">
        <div className="-mx-3">
          <div className="grid grid-cols-[160px_80px_1fr] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
            <span>Metric</span>
            <span>Score</span>
            <span>Detail</span>
          </div>
          <ul className="flex flex-col border-t border-studio-rule">
            {cartridge.health.metrics.map((item) => (
              <li
                key={item.label}
                className="grid items-baseline gap-4 px-3 py-2.5 md:grid-cols-[160px_80px_1fr]"
              >
                <span className="text-[13px] font-medium text-studio-ink-strong">
                  {item.label}
                </span>
                <span className={`font-mono text-[13px] ${metricScoreTone(item.tone)}`}>
                  {item.value}
                </span>
                <span>
                  <span className="block text-[12.5px] text-studio-ink">{item.detail}</span>
                  <span className="mt-0.5 block text-[11px] text-studio-ink-faint">
                    {item.calculation}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section label="Coverage">
        <CoverageMatrix rows={cartridge.health.coverageMatrix} />
      </Section>

      <Section label="Sources">
        <SourceTable cartridge={cartridge} />
      </Section>
    </main>
  );
}

function recommendationTone(kind: string): string {
  switch (kind) {
    case "keep": return "text-[var(--status-ok-fg)]";
    case "refresh": return "text-studio-ink-strong";
    case "rebuild": return "text-[var(--status-warn-fg)]";
    case "block": return "text-[var(--status-error-fg)]";
    default: return "text-studio-ink";
  }
}

function metricScoreTone(tone: HealthTone): string {
  switch (tone) {
    case "ok": return "text-[var(--status-ok-fg)]";
    case "warn": return "text-[var(--status-warn-fg)]";
    case "error": return "text-[var(--status-error-fg)]";
    default: return "text-studio-ink";
  }
}

function CartridgePlanPage({
  cartridge,
  plan,
}: {
  cartridge: ContextCartridge;
  plan: CartridgePlan;
}) {
  const profile = cartridge.profiles.find((candidate) => candidate.id === plan.profileId);
  const modeLabel = plan.mode === "fork" ? "fork" : "launch";
  const targetMeta = [
    plan.target.model ?? plan.target.provider,
    plan.target.cwd ?? "portable",
    plan.target.compatibility,
  ].filter(Boolean);

  return (
    <main className="max-w-6xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <CartridgeHeader cartridge={cartridge} eyebrow={modeLabel} />

      <Section label="Target">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[16px] font-medium text-studio-ink-strong">
            {plan.target.label}
          </span>
          <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${planStatusTone(plan.status)}`}>
            {plan.status}
          </span>
          <span className="font-mono text-[11px] text-studio-ink-faint">
            · {plan.lineage.label.toLowerCase()}
          </span>
        </div>
        <p className="mt-2 max-w-[78ch] text-[13px] leading-[1.6] text-studio-ink">
          {plan.target.reason}
        </p>
        <p className="mt-2 font-mono text-[11px] text-studio-ink-faint">
          {targetMeta.join("  ·  ")}
        </p>
      </Section>

      {profile ? (
        <Section label="Budget">
          <div className="flex flex-wrap items-baseline gap-3 font-mono text-[11px] text-studio-ink">
            <span className="text-[13px]">{profile.name}</span>
            <span className="text-studio-ink-faint">
              · {fmtTokens(profileTokenTotal(cartridge, profile.id))} of {fmtTokens(profile.tokenTarget)} target
            </span>
            <span className="text-studio-ink-faint">
              · max {fmtTokens(profile.maxTokens)}
            </span>
          </div>
          <TokenMeter
            value={profileTokenTotal(cartridge, profile.id)}
            target={profile.tokenTarget}
            max={profile.maxTokens}
          />
        </Section>
      ) : null}

      <Section label="Preflight">
        <ul className="flex flex-col gap-1.5">
          {plan.checks.map((check) => (
            <li key={check.id} className="grid grid-cols-[100px_1fr] gap-3 text-[12.5px] leading-[1.55]">
              <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${preflightTone(check.tone)}`}>
                {check.label}
              </span>
              <span className="text-studio-ink">{check.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      {plan.transferDecisions ? (
        <Section label="Transfers">
          <TransferTable plan={plan} />
        </Section>
      ) : null}

      <Section label="Compiled prompt">
        <ul className="flex flex-col gap-4">
          {plan.promptParts.map((part) => (
            <li key={part.slot}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[12px] text-studio-ink-strong">
                  {part.slot}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-studio-ink-faint">
                  {part.required ? "required" : "optional"} · {part.truth}
                </span>
                <span className="ml-auto font-mono text-[11px] text-studio-ink-faint">
                  {fmtTokens(part.tokens)} tokens
                </span>
              </div>
              <p className="mt-1 max-w-[80ch] text-[12.5px] leading-[1.55] text-studio-ink">
                {part.body}
              </p>
              <p className="mt-1 font-mono text-[10.5px] text-studio-ink-faint">
                from {part.fromPartIds.join(", ")}
                {part.transform ? ` · transform: ${part.transform}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Sidecars">
        <ul className="flex flex-col gap-1.5">
          {plan.sidecars.map((sidecar) => (
            <li key={sidecar.path} className="grid grid-cols-[1fr_100px] items-baseline gap-3">
              <code className="text-[11.5px] text-studio-ink">{sidecar.path}</code>
              <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${sidecar.materialized ? "text-[var(--status-ok-fg)]" : "text-[var(--status-warn-fg)]"}`}>
                {sidecar.materialized ? "ready" : "pending"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Lineage">
        <p className="text-[13px] text-studio-ink">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-studio-ink-faint">
            {plan.lineage.label}
          </span>{" "}
          — {plan.lineage.reason}
        </p>
      </Section>

      <Section label="Plan record">
        <CodeViewer
          filename={`${plan.id}.json`}
          content={planRecord(plan)}
          themeDetection={{ mode: "data-attribute", attr: "data-theme", lightValue: "light" }}
          className="overflow-hidden border border-studio-rule"
        />
      </Section>
    </main>
  );
}

function planStatusTone(status: string): string {
  switch (status) {
    case "ready": return "text-[var(--status-ok-fg)]";
    case "warnings": return "text-[var(--status-warn-fg)]";
    default: return "text-[var(--status-error-fg)]";
  }
}

function preflightTone(tone: HealthTone): string {
  switch (tone) {
    case "ok": return "text-[var(--status-ok-fg)]";
    case "warn": return "text-[var(--status-warn-fg)]";
    case "error": return "text-[var(--status-error-fg)]";
    default: return "text-studio-ink-faint";
  }
}

export function StudyPage({ study }: { study: Study }) {
  if (study.slug === "planner-workbench") return <PlannerStudyPage study={study} />;
  if (study.slug === "health-console") return <HealthStudyPage study={study} />;
  return <NotFoundPage />;
}

function PlannerStudyPage({ study }: { study: Study }) {
  const cartridge = CONTEXT_CARTRIDGES[0];
  return (
    <main className="max-w-6xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <StudyHeader study={study} />

      <Section label="Planner stages">
        <div className="-mx-3">
          <div className="grid grid-cols-[140px_1fr_120px] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
            <span>Stage</span>
            <span>Latest proposal</span>
            <span>Status</span>
          </div>
          <ul className="flex flex-col border-t border-studio-rule">
            {cartridge.planner.map((stage) => (
              <li
                key={stage.id}
                className="grid items-baseline gap-4 px-3 py-2.5 md:grid-cols-[140px_1fr_120px]"
              >
                <span className="text-[13px] font-medium text-studio-ink-strong">
                  {stage.label}
                </span>
                <span className="text-[12.5px] leading-[1.55] text-studio-ink-faint">
                  {stage.proposal.summary}
                </span>
                <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${plannerStatusTone(stage.status)}`}>
                  {stage.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section label="Load profiles">
        <ProfileGrid cartridge={cartridge} />
      </Section>
    </main>
  );
}

function HealthStudyPage({ study }: { study: Study }) {
  const cartridge = CONTEXT_CARTRIDGES[0];
  const rec = cartridge.health.recommendation;
  return (
    <main className="max-w-6xl px-7 pt-5 pb-12 text-studio-ink md:px-10 md:pt-6 md:pb-14">
      <StudyHeader study={study} />

      <Section label="Recommendation">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className={`font-mono text-[14px] uppercase tracking-[0.1em] ${recommendationTone(rec.kind)}`}>
            {rec.label}
          </span>
        </div>
        <p className="mt-3 max-w-[78ch] text-[14px] leading-[1.65] text-studio-ink">
          {rec.why}
        </p>
      </Section>

      <Section label="Metrics">
        <div className="-mx-3">
          <div className="grid grid-cols-[160px_80px_1fr] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
            <span>Metric</span>
            <span>Score</span>
            <span>Detail</span>
          </div>
          <ul className="flex flex-col border-t border-studio-rule">
            {cartridge.health.metrics.map((item) => (
              <li
                key={item.label}
                className="grid items-baseline gap-4 px-3 py-2.5 md:grid-cols-[160px_80px_1fr]"
              >
                <span className="text-[13px] font-medium text-studio-ink-strong">
                  {item.label}
                </span>
                <span className={`font-mono text-[13px] ${metricScoreTone(item.tone)}`}>
                  {item.value}
                </span>
                <span className="text-[12.5px] text-studio-ink">{item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section label="Sources">
        <SourceTable cartridge={cartridge} />
      </Section>
    </main>
  );
}

function CartridgeHeader({
  cartridge,
  eyebrow,
}: {
  cartridge: ContextCartridge;
  eyebrow: string;
}) {
  const meta = [
    cartridge.scope.path,
    cartridge.scope.branchHint,
    `refresh by ${cartridge.freshness.refreshBy}`,
    `owner ${cartridge.owner}`,
  ].filter(Boolean);

  return (
    <header>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
        <span>{eyebrow}</span>
        <span className="text-studio-ink-faint/60">·</span>
        <span>{cartridge.lifecycle}</span>
        <span className="text-studio-ink-faint/60">·</span>
        <span>{cartridge.version}</span>
      </div>
      <h1 className="mt-3 max-w-[860px] text-[28px] font-medium leading-[1.15] text-studio-ink-strong md:text-[36px]">
        {cartridge.name}
      </h1>
      <p className="mt-4 max-w-[72ch] text-[15px] leading-[1.7] text-studio-ink">
        {cartridge.intent}
      </p>
      <p className="mt-3 font-mono text-[11px] text-studio-ink-faint">
        {meta.join("  ·  ")}
      </p>
    </header>
  );
}

function SourceTable({ cartridge }: { cartridge: ContextCartridge }) {
  return (
    <div className="-mx-3">
      <div className="grid grid-cols-[1fr_1fr_180px] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
        <span>Source</span>
        <span>Where</span>
        <span>Status</span>
      </div>
      <ul className="flex flex-col border-t border-studio-rule">
        {cartridge.sources.map((source) => (
          <li
            key={source.id}
            className="grid items-baseline gap-4 px-3 py-2.5 md:grid-cols-[1fr_1fr_180px]"
          >
            <span>
              <span className="block text-[13px] text-studio-ink-strong">
                {source.name}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-studio-ink-faint">
                {familyLabel(source.family)}
              </span>
            </span>
            <span>
              <code className="block text-[11.5px] text-studio-ink">
                {source.path}
              </code>
              <span className="mt-0.5 block text-[11.5px] text-studio-ink-faint">
                {source.coverage}
              </span>
            </span>
            <span className={`text-[12px] ${sourceStatusTone(source.state)}`}>
              {sourceStatusLabel(source.state, source.truth)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function familyLabel(family: ContextCartridge["sources"][number]["family"]): string {
  switch (family) {
    case "session": return "session log";
    case "doc": return "document";
    case "reconstruction": return "reconstruction";
    case "manual": return "manual notes";
    default: return family;
  }
}

function sourceStatusLabel(state: SourceState, truth: TruthState): string {
  const truthWord =
    truth === "logged" ? "logged" :
    truth === "reconstructed" ? "reconstructed" :
    truth === "inferred" ? "inferred" :
    "manual";
  const stateWord =
    state === "fresh" ? "current" :
    state === "review" ? "needs review" :
    state === "stale" ? "stale" :
    "missing";
  return `${stateWord} · ${truthWord}`;
}

function sourceStatusTone(state: SourceState): string {
  switch (state) {
    case "fresh": return "text-studio-ink";
    case "review": return "text-studio-ink";
    case "stale": return "text-[var(--status-warn-fg)]";
    case "missing": return "text-[var(--status-error-fg)]";
  }
}

function PartRow({ part }: { part: CartridgePart }) {
  return (
    <li className="grid gap-3 py-2.5 md:grid-cols-[40px_1fr_140px]">
      <span className="font-mono text-[11px] text-studio-ink-faint">
        {String(part.order).padStart(2, "0")}
      </span>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[14px] font-medium text-studio-ink-strong">
            {part.title}
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-studio-ink-faint">
            {part.required ? "required" : "optional"}
          </span>
        </div>
        <p className="mt-1 max-w-[78ch] text-[12.5px] leading-[1.55] text-studio-ink-faint">
          {part.body}
        </p>
      </div>
      <span className="self-baseline text-right font-mono text-[11px] text-studio-ink-faint">
        {fmtTokens(part.tokens)} tokens
      </span>
    </li>
  );
}

function ProfileGrid({ cartridge }: { cartridge: ContextCartridge }) {
  return (
    <div className="-mx-3">
      <div className="grid grid-cols-[140px_1fr_160px] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
        <span>Profile</span>
        <span>Description</span>
        <span>Budget</span>
      </div>
      <ul className="flex flex-col border-t border-studio-rule">
        {cartridge.profiles.map((profile) => {
          const total = profileTokenTotal(cartridge, profile.id);
          return (
            <li
              key={profile.id}
              className="grid items-baseline gap-4 px-3 py-3 md:grid-cols-[140px_1fr_160px]"
            >
              <span>
                <span className="block text-[14px] font-medium text-studio-ink-strong">
                  {profile.name}
                </span>
                <span className="mt-0.5 block font-mono text-[10.5px] text-studio-ink-faint">
                  {profile.state}
                </span>
              </span>
              <span className="text-[12.5px] leading-[1.55] text-studio-ink-faint">
                {profile.description}
              </span>
              <span className="text-right font-mono text-[11px] text-studio-ink">
                {fmtTokens(total)} / {fmtTokens(profile.tokenTarget)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TokenStrip({
  cartridge,
  profileId,
}: {
  cartridge: ContextCartridge;
  profileId: LoadProfileId;
}) {
  const profile = cartridge.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) return null;
  const required = partsForProfile(cartridge, profileId)
    .filter((part) => part.required)
    .reduce((sum, part) => sum + part.tokens, 0);
  const total = profileTokenTotal(cartridge, profileId);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 font-mono text-[11px] text-studio-ink-faint">
        <span>
          working set · {fmtTokens(total)} of {fmtTokens(profile.tokenTarget)} target
        </span>
        <span>· {fmtTokens(required)} required</span>
      </div>
      <TokenMeter value={total} target={profile.tokenTarget} max={profile.maxTokens} />
    </div>
  );
}

function TokenMeter({ value, target, max }: { value: number; target: number; max: number }) {
  const valuePct = Math.min(100, Math.round((value / max) * 100));
  const targetPct = Math.min(100, Math.round((target / max) * 100));
  return (
    <div className="relative mt-3 h-2 bg-studio-chip-bg">
      <div className="h-full bg-scout-accent" style={{ width: `${valuePct}%` }} />
      <div className="absolute top-[-3px] h-4 w-px bg-studio-ink-strong" style={{ left: `${targetPct}%` }} />
    </div>
  );
}

function EvalTable({ cartridge }: { cartridge: ContextCartridge }) {
  return (
    <div className="-mx-3">
      <div className="grid grid-cols-[1fr_100px_80px] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
        <span>Case</span>
        <span>Target</span>
        <span>Result</span>
      </div>
      <ul className="flex flex-col border-t border-studio-rule">
        {cartridge.evals.map((evalCase) => (
          <li
            key={evalCase.id}
            className="grid items-baseline gap-4 px-3 py-2.5 md:grid-cols-[1fr_100px_80px]"
          >
            <span>
              <span className="block text-[13px] text-studio-ink-strong">
                {evalCase.name}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-studio-ink-faint">
                {evalCase.truthClaim}
              </span>
            </span>
            <span className="font-mono text-[11.5px] text-studio-ink-faint">
              {evalCase.target}
            </span>
            <span className={`font-mono text-[11.5px] uppercase tracking-[0.1em] ${evalResultTone(evalCase.result)}`}>
              {evalCase.result}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function evalResultTone(result: string): string {
  switch (result) {
    case "pass": return "text-[var(--status-ok-fg)]";
    case "warn": return "text-[var(--status-warn-fg)]";
    case "fail": return "text-[var(--status-error-fg)]";
    default: return "text-studio-ink-faint";
  }
}

function CoverageMatrix({ rows }: { rows: CoverageRow[] }) {
  const profiles: LoadProfileId[] = ["briefing", "working-set", "deep-pack"];
  return (
    <div className="-mx-3">
      <div className="grid grid-cols-[120px_repeat(3,1fr)] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
        <span>Target</span>
        {profiles.map((profile) => (
          <span key={profile}>{profile}</span>
        ))}
      </div>
      <ul className="flex flex-col border-t border-studio-rule">
        {rows.map((row) => (
          <li
            key={row.target}
            className="grid items-baseline gap-4 px-3 py-2 md:grid-cols-[120px_repeat(3,1fr)]"
          >
            <span className="font-mono text-[12px] text-studio-ink-strong">
              {row.target}
            </span>
            {profiles.map((profile) => (
              <span key={profile} className="text-[13px] text-studio-ink">
                {coverageLabel(row.cells[profile])}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function coverageLabel(value: CoverageRow["cells"][LoadProfileId]): string {
  switch (value) {
    case "full": return "full";
    case "partial": return "partial";
    case "none": return "none";
    case "n/a": return "—";
  }
}

function TransferTable({ plan }: { plan: CartridgePlan }) {
  return (
    <div className="-mx-3">
      <div className="grid grid-cols-[180px_80px_140px_1fr] gap-4 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
        <span>Source part</span>
        <span>Action</span>
        <span>Target slot</span>
        <span>Reason</span>
      </div>
      <ul className="flex flex-col border-t border-studio-rule">
        {plan.transferDecisions?.map((decision) => (
          <li
            key={`${decision.sourcePart}-${decision.action}`}
            className="grid items-baseline gap-4 px-3 py-2 md:grid-cols-[180px_80px_140px_1fr]"
          >
            <code className="text-[11.5px] text-studio-ink">{decision.sourcePart}</code>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-studio-ink">
              {decision.action}
            </span>
            <span className="font-mono text-[11px] text-studio-ink-faint">
              {decision.targetSlot ?? "drop"}
            </span>
            <span className="text-[12.5px] leading-[1.55] text-studio-ink">
              {decision.reason}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NotFoundPage() {
  const { Link } = useStudioRouter();
  return (
    <main className="max-w-3xl px-7 pt-8 pb-12 text-studio-ink md:px-10">
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

function StudyHeader({ study }: { study: Study }) {
  return (
    <header>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
        design study
      </div>
      <h1 className="mt-3 text-[28px] font-medium leading-[1.15] text-studio-ink-strong md:text-[36px]">
        {study.title}
      </h1>
      <p className="mt-3 max-w-[68ch] text-[15px] leading-[1.7] text-studio-ink">
        {study.summary}
      </p>
    </header>
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

function MetricTile({ item }: { item: HealthMetric }) {
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
      <div className="mt-5 text-[26px] font-medium leading-none text-studio-ink-strong">
        {item.value}
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-studio-ink-faint">
        {item.detail}
      </p>
      <p className="mt-3 border-t border-studio-rule pt-3 text-[11.5px] leading-relaxed text-studio-ink-faint">
        {item.calculation}
      </p>
    </div>
  );
}

export const presentationIcons = {
  "CTX-001": SearchCode,
  "CTX-002": PackageOpen,
  "CTX-003": ClipboardList,
  "CTX-004": Gauge,
  "CTX-005": Rocket,
};
