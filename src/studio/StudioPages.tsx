"use client";

import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { DataRow, EngDocSheet, EngMarkdown } from "studio/doc";
import { useStudioRouter } from "studio/router";

import type { CtxDoc } from "@/studio/ctxDocs";
import {
  HOME_HREF,
  statusPalette,
  type PresentationRef,
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
    job: "Bundle context into versioned packages, with sources attached.",
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
  ["Files over chat", "Save planning conversations as files, not threads."],
  ["Sources stay separate from notes", "Keep logged, reconstructed, inferred, and manual content distinguishable."],
  ["Profiles, not monoliths", "Briefing, working set, deep pack. Different jobs need different loads."],
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
          what happens inside the model — that's the provider's job. The main
          app is the product; Studio is here to make ideas pretty enough to
          look at and read engineering notes.
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

      <Section label="Engineering notes">
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
        Overview
      </Link>
    </main>
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
