import { createRegistry, type StudioPage } from "studio";
import { createStatusPalette } from "studio/atoms";

import type { CtxDoc } from "@/studio/ctxDocs";

export type StudioBucket = "foundations" | "notes" | "prototypes";
export type StudioSurface = "vision" | "engineering";
export type StudioStatus = "active" | "draft" | "study";
export type ContextualStudioPage = StudioPage<StudioBucket, StudioSurface, StudioStatus>;

export interface PresentationRef {
  id: string;
  href: string;
  title: string;
  summary: string;
  status: StudioStatus;
  source: string[];
}

export const HOME_HREF = "/studio";

function summaryForDoc(doc: CtxDoc): string {
  return doc.blurb ?? doc.title;
}

function presentationsFromDocs(docs: readonly CtxDoc[]): PresentationRef[] {
  return docs.map((doc) => ({
    id: doc.id,
    href: doc.href,
    title: doc.title,
    summary: summaryForDoc(doc),
    status: doc.status,
    source: [doc.source],
  }));
}

export const statusPalette = createStatusPalette<StudioStatus>({
  active: { tone: "ok", label: "ACTIVE" },
  draft: { tone: "warn", label: "DRAFT" },
  study: { tone: "info", label: "STUDY" },
});

export const STATUS_COLORS: Record<StudioStatus, string> = {
  active: statusPalette.statusToColor("active"),
  draft: statusPalette.statusToColor("draft"),
  study: statusPalette.statusToColor("study"),
};

export const BUCKETS = [
  { key: "foundations" },
  { key: "notes", title: "Engineering notes" },
  { key: "prototypes", title: "Prototypes" },
] as const;

export const PACKAGE_VIEW_PROTOTYPE_HREF = "/studio/package-view";

export function bucketLabel(bucket: StudioBucket): string {
  switch (bucket) {
    case "foundations":
      return "Foundations";
    case "notes":
      return "Engineering notes";
    case "prototypes":
      return "Prototypes";
  }
}

export function surfaceLabel(surface: StudioSurface): string {
  switch (surface) {
    case "vision":
      return "Vision";
    case "engineering":
      return "Engineering";
  }
}

export function normalizeStudioPath(pathname: string | null): string {
  if (!pathname || pathname === "/studio/") return HOME_HREF;
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}

export interface ContextualRegistry {
  presentations: readonly PresentationRef[];
  STUDIO_PAGES: readonly ContextualStudioPage[];
  registry: ReturnType<
    typeof createRegistry<StudioBucket, StudioSurface, StudioStatus>
  >;
  presentationForHref: (href: string) => PresentationRef | undefined;
}

export function buildContextualRegistry(
  docs: readonly CtxDoc[],
): ContextualRegistry {
  const presentations = presentationsFromDocs(docs);

  const STUDIO_PAGES: ContextualStudioPage[] = [
    {
      href: HOME_HREF,
      label: "Overview",
      bucket: "foundations",
      surface: "vision",
      status: "active",
      blurb: "What Contextual is and what it stays out of.",
      source: ["docs/ENG-contextual-platform.md"],
    },
    {
      href: PACKAGE_VIEW_PROTOTYPE_HREF,
      label: "Package view — hybrid",
      bucket: "prototypes",
      surface: "engineering",
      status: "draft",
      blurb: "Redesign prototype: guided flow → diff-on-cards. Mock data, faked agent.",
      source: ["src/studio/prototypes/PackageViewPrototype.tsx"],
    },
    ...presentations.map(
      (p): ContextualStudioPage => ({
        href: p.href,
        label: `${p.id} - ${p.title}`,
        bucket: "notes",
        surface: "engineering",
        status: p.status,
        blurb: p.summary,
        source: p.source,
      }),
    ),
  ];

  const registry = createRegistry<StudioBucket, StudioSurface, StudioStatus>({
    pages: STUDIO_PAGES,
    surfaceOrder: ["vision", "engineering"],
    defaultSurface: "engineering",
    bucketLabel,
    surfaceLabel,
  });

  return {
    presentations,
    STUDIO_PAGES,
    registry,
    presentationForHref: (href) => {
      return presentations.find((p) => {
        if (p.href === href) return true;
        return p.href.replace("/ctx-", "/cth-") === href;
      });
    },
  };
}
