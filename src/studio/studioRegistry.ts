import { createRegistry, type StudioPage } from "studio";
import { createStatusPalette } from "studio/atoms";

import { CONTEXT_CARTRIDGES } from "@/data/contextCartridges";
import type { CtxDoc } from "@/studio/ctxDocs";

export type StudioBucket = "foundations" | "presentations" | "cartridges" | "studies";
export type StudioSurface = "vision" | "engineering" | "product" | "design";
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

export interface Study {
  slug: string;
  title: string;
  href: string;
  status: StudioStatus;
  source: string[];
  summary: string;
}

export type CartridgeRouteKind = "index" | "detail" | "planner" | "health" | "launch" | "fork";

export interface CartridgeRoute {
  kind: CartridgeRouteKind;
  cartridgeId?: string;
  title: string;
  href: string;
  summary: string;
  status: StudioStatus;
  source: string[];
}

export const HOME_HREF = "/studio";
export const CARTRIDGES_HREF = "/studio/cartridges";

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

export const cartridgeRoutes: readonly CartridgeRoute[] = [
  {
    kind: "index",
    title: "Cartridges",
    href: CARTRIDGES_HREF,
    status: "active",
    source: ["docs/ENG-001-agentic-context-cartridge.md"],
    summary: "Active context cartridges.",
  },
  ...CONTEXT_CARTRIDGES.flatMap((cartridge): CartridgeRoute[] => [
    {
      kind: "detail",
      cartridgeId: cartridge.id,
      title: cartridge.name,
      href: `${CARTRIDGES_HREF}/${cartridge.id}`,
      status: "active",
      source: [
        "docs/ENG-001-agentic-context-cartridge.md",
        "src/data/contextCartridges.ts",
      ],
      summary: cartridge.intent,
    },
    {
      kind: "planner",
      cartridgeId: cartridge.id,
      title: `${cartridge.name} Planner`,
      href: `${CARTRIDGES_HREF}/${cartridge.id}/planner`,
      status: "active",
      source: ["docs/ENG-002-live-cartridge-surfaces.md"],
      summary: "Planning stages and decision ledger.",
    },
    {
      kind: "health",
      cartridgeId: cartridge.id,
      title: `${cartridge.name} Health`,
      href: `${CARTRIDGES_HREF}/${cartridge.id}/health`,
      status: "active",
      source: ["docs/ENG-002-live-cartridge-surfaces.md"],
      summary: "Efficiency, freshness, coverage, provenance, evals — and what to do about it.",
    },
    {
      kind: "launch",
      cartridgeId: cartridge.id,
      title: `${cartridge.name} Launch`,
      href: `${CARTRIDGES_HREF}/${cartridge.id}/launch`,
      status: "active",
      source: ["docs/CONTRACT-launch-and-fork.md"],
      summary: "Launch plan preview and compiled prompt parts for the target.",
    },
    {
      kind: "fork",
      cartridgeId: cartridge.id,
      title: `${cartridge.name} Fork`,
      href: `${CARTRIDGES_HREF}/${cartridge.id}/fork`,
      status: "active",
      source: ["docs/CONTRACT-launch-and-fork.md"],
      summary: "Fork preview with the lineage labeled honestly: native, replay, or manual.",
    },
  ]),
];

export const studies: readonly Study[] = [
  {
    slug: "planner-workbench",
    title: "Planner Workbench",
    href: "/studio/studies/planner-workbench",
    status: "study",
    source: ["docs/ENG-cartridge-planner-studio.md"],
    summary: "Intent, scope, sources, targets, evals, profiles — all for one seed cartridge.",
  },
  {
    slug: "health-console",
    title: "Health Console",
    href: "/studio/studies/health-console",
    status: "study",
    source: ["docs/ENG-cartridge-planner-studio.md"],
    summary: "Efficiency, freshness, coverage, provenance, evals — and the rebuild call.",
  },
];

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
  { key: "presentations", title: "Planning notes" },
  { key: "cartridges", title: "Cartridges" },
  { key: "studies" },
] as const;

export function bucketLabel(bucket: StudioBucket): string {
  switch (bucket) {
    case "foundations":
      return "Foundations";
    case "presentations":
      return "Planning notes";
    case "cartridges":
      return "Cartridges";
    case "studies":
      return "Studies";
  }
}

export function surfaceLabel(surface: StudioSurface): string {
  switch (surface) {
    case "vision":
      return "Vision";
    case "engineering":
      return "Engineering";
    case "product":
      return "Product";
    case "design":
      return "Design";
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
  cartridgeRouteForHref: (href: string) => CartridgeRoute | undefined;
  studyForHref: (href: string) => Study | undefined;
}

/**
 * Build the studio registry from a list of parsed CTX docs.
 * Called on the server (page entry) and threaded through to the client
 * shell — so editing a CTX-NNN markdown file updates sidebar order,
 * label, status, and blurb without touching code.
 */
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
    ...presentations.map(
      (p): ContextualStudioPage => ({
        href: p.href,
        label: `${p.id} - ${p.title}`,
        bucket: "presentations",
        surface: "engineering",
        status: p.status,
        blurb: p.summary,
        source: p.source,
      }),
    ),
    ...cartridgeRoutes.map(
      (route): ContextualStudioPage => ({
        href: route.href,
        label: route.title,
        bucket: "cartridges",
        surface: "product",
        status: route.status,
        blurb: route.summary,
        source: route.source,
      }),
    ),
    ...studies.map(
      (study): ContextualStudioPage => ({
        href: study.href,
        label: study.title,
        bucket: "studies",
        surface: "design",
        status: study.status,
        blurb: study.summary,
        source: study.source,
      }),
    ),
  ];

  const registry = createRegistry<StudioBucket, StudioSurface, StudioStatus>({
    pages: STUDIO_PAGES,
    surfaceOrder: ["vision", "engineering", "product", "design"],
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
    cartridgeRouteForHref: (href) =>
      cartridgeRoutes.find((route) => route.href === href),
    studyForHref: (href) => studies.find((study) => study.href === href),
  };
}
