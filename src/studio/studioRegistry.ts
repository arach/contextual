import { createRegistry, type StudioPage } from "studio";
import { createStatusPalette } from "studio/atoms";

export type StudioBucket = "foundations" | "presentations" | "studies";
export type StudioSurface = "vision" | "engineering" | "design";
export type StudioStatus = "active" | "draft" | "study";
export type ContextualStudioPage = StudioPage<StudioBucket, StudioSurface, StudioStatus>;

export interface PresentationSection {
  eyebrow: string;
  title: string;
  body: string[];
  bullets?: string[];
}

export interface Presentation {
  id: string;
  title: string;
  href: string;
  status: StudioStatus;
  source: string[];
  summary: string;
  thesis: string;
  sections: PresentationSection[];
  next: string[];
}

export interface Study {
  slug: string;
  title: string;
  href: string;
  status: StudioStatus;
  source: string[];
  summary: string;
}

export const HOME_HREF = "/studio";

export const presentations: readonly Presentation[] = [
  {
    id: "CTH-001",
    title: "North Star And Boundary",
    href: "/studio/cth-001",
    status: "active",
    source: ["docs/ENG-contextual-platform.md"],
    summary:
      "Contextual is upstream context tooling: it prepares strong starting positions and records how those starts were made.",
    thesis:
      "Do not chase hidden live provider state. Win the durable boundary before launch, at package time, and at explicit fork time.",
    sections: [
      {
        eyebrow: "shift",
        title: "The provider layer is getting less reproducible.",
        body: [
          "Claude, Codex, and adjacent harnesses are moving more context work server-side: caching, compression, memory, summaries, and session reconstruction. That makes in-flight context mutation a weak product boundary.",
          "Contextual should assume the live buffer is partly opaque. The durable product is the preparation layer: what sources were selected, how they were compacted, what was omitted, what was tested, and how the target agent was launched.",
        ],
      },
      {
        eyebrow: "north star",
        title: "A planner, compiler, and profiler for agent starting context.",
        body: [
          "The tool should help a developer and an agent build a context cartridge: a compact, source-backed starter pack with target-specific load profiles.",
          "The runtime should let an agent request a launch or fork from that cartridge without pretending Contextual controls hidden provider memory.",
        ],
      },
      {
        eyebrow: "verbs",
        title: "Explore and Package are developer-first. Instantiate and Fork are agent-first.",
        body: [
          "Explore and Package need excellent human ergonomics because they are judgment surfaces: what happened, what matters, what should be kept, and what is stale.",
          "Instantiate and Fork need excellent agent ergonomics because they are execution surfaces: compile the context, label the lineage, materialize sidecars, and start from a known plan.",
        ],
        bullets: [
          "Explore: inspect source truth, sessions, docs, manifests, and evidence.",
          "Package: curate reusable context into versioned artifacts.",
          "Instantiate: compile a target-specific launch plan.",
          "Fork: continue from explicit lineage without false continuity.",
        ],
      },
    ],
    next: [
      "Make the cartridge the primary product object.",
      "Keep native harness records as source truth.",
      "Measure every starter pack for efficiency, freshness, coverage, provenance, and evals.",
    ],
  },
  {
    id: "CTH-002",
    title: "Context Cartridge Artifact",
    href: "/studio/cth-002",
    status: "active",
    source: ["docs/CONTRACT-session-package.md", "docs/ENG-cartridge-planner-studio.md"],
    summary:
      "A cartridge is a versioned artifact that contains intent, sources, parts, profiles, provenance, freshness, and eval state.",
    thesis:
      "The package is not a transcript dump. It is the reusable engineering object a future session can load with confidence.",
    sections: [
      {
        eyebrow: "object",
        title: "Cartridges are the stable unit of reuse.",
        body: [
          "A cartridge should contain the user intent, source set, curated parts, load profiles, provenance, compatibility, freshness policy, and history.",
          "That lets Contextual answer whether a starter pack is safe to load, too stale to trust, or too large for the target run.",
        ],
      },
      {
        eyebrow: "contract",
        title: "Parts carry source refs, hashes, and truth labels.",
        body: [
          "Each cartridge part needs to know where it came from and how confident we are in it. Logged, reconstructed, inferred, and manual content should not collapse into the same bucket.",
          "This is what keeps the tool honest when a launch target cannot preserve native state exactly.",
        ],
      },
    ],
    next: [
      "Introduce `ContextCartridge`, `LoadProfile`, `SourceRef`, and `EvalCase` types.",
      "Persist a seed `agent-harness-context` cartridge.",
      "Render parts, sources, profiles, and version state in Studio.",
    ],
  },
  {
    id: "CTH-003",
    title: "Collaborative Context Planner",
    href: "/studio/cth-003",
    status: "draft",
    source: ["docs/ENG-cartridge-planner-studio.md"],
    summary:
      "The planning conversation should happen in the tool, then compile into a cartridge rather than staying trapped in a chat transcript.",
    thesis:
      "Contextual should turn the conversation that produced this strategy into structured planner decisions.",
    sections: [
      {
        eyebrow: "workflow",
        title: "The user and agent design the starter pack together.",
        body: [
          "The planner starts with an objective, then asks for scope, source families, target agents, load profiles, evals, and refresh rules.",
          "The output is not just prose. It is a plan that can be diffed, rebuilt, evaluated, and turned into launch material.",
        ],
      },
      {
        eyebrow: "ergonomics",
        title: "Planning replaces static package editing.",
        body: [
          "Package editing should feel like designing an efficient session, not filling out a schema by hand.",
          "The agent can do the source gathering and first-pass synthesis. The developer should review boundaries, omissions, and freshness decisions.",
        ],
      },
    ],
    next: [
      "Add planner stages: intent, scope, sources, targets, profiles, evals.",
      "Store decisions as structured rows with human-readable notes.",
      "Generate cartridge build tasks from the accepted plan.",
    ],
  },
  {
    id: "CTH-004",
    title: "Evidence And Health",
    href: "/studio/cth-004",
    status: "draft",
    source: ["docs/ENG-contextual-platform.md", "docs/HARNESS-CONTRACT.md"],
    summary:
      "Explorer becomes the evidence engine underneath cartridge quality, not the product destination by itself.",
    thesis:
      "A cartridge is only worth loading when it is compact, current, covered, source-backed, and passing evals.",
    sections: [
      {
        eyebrow: "reframe",
        title: "Explorer answers diagnostic questions.",
        body: [
          "The session explorer remains valuable, but it should appear when a cartridge claim needs proof: why is this included, what changed, what can be removed, and what source supports it.",
          "The source ladder stays visible from native records through manifests, atoms, blocks, packages, and launch plans.",
        ],
      },
      {
        eyebrow: "metrics",
        title: "Health should produce a rebuild decision.",
        body: [
          "Efficiency, freshness, coverage, provenance, and eval status should produce a recommendation: keep, refresh, rebuild, or block launch.",
          "A good health surface points at exact source gaps instead of merely displaying a score.",
        ],
      },
    ],
    next: [
      "Compute token cost, duplication, low-signal percentage, and source coverage.",
      "Track freshness by source family.",
      "Attach diagnostics to exact evidence paths and sessions.",
    ],
  },
  {
    id: "CTH-005",
    title: "Launch Profiles And Fork Trees",
    href: "/studio/cth-005",
    status: "active",
    source: ["docs/CONTRACT-launch-and-fork.md", "docs/CTX-001-pi-ai-backend.md"],
    summary:
      "Instantiate and fork should compile cartridges into explicit target plans with honest lineage labels.",
    thesis:
      "Forking is useful when it is truthful: native fork, replay fork, recipe-derived launch, or manual fork.",
    sections: [
      {
        eyebrow: "targets",
        title: "Different agents get different load profiles.",
        body: [
          "Codex, Claude, pi, and pi-ai do not share the same native affordances. A cartridge should compile into briefing, working-set, and deep-pack profiles that fit each target.",
          "pi-ai is a portable context handoff target. pi-coding-agent is the native tree and fork target. Contextual should label that distinction instead of hiding it.",
        ],
      },
      {
        eyebrow: "lineage",
        title: "A fork is not automatically identical continuation.",
        body: [
          "When a target harness can create a parent-linked native session, Contextual can label it as a native fork. When it cannot, Contextual can still produce a replay or recipe fork with explicit transfer decisions.",
          "The value is not perfect hidden-state cloning. The value is auditable continuity from a known manifest.",
        ],
      },
    ],
    next: [
      "Compile briefing, working-set, and deep-pack profiles.",
      "Preview target-specific prompt and sidecar materialization.",
      "Record instantiation and fork records before execution.",
    ],
  },
];

export const studies: readonly Study[] = [
  {
    slug: "planner-workbench",
    title: "Planner Workbench",
    href: "/studio/studies/planner-workbench",
    status: "study",
    source: ["docs/ENG-cartridge-planner-studio.md"],
    summary: "Intent, scope, sources, targets, evals, and profiles for a seed cartridge.",
  },
  {
    slug: "health-console",
    title: "Health Console",
    href: "/studio/studies/health-console",
    status: "study",
    source: ["docs/ENG-cartridge-planner-studio.md"],
    summary: "Efficiency, freshness, coverage, provenance, evals, and rebuild recommendation.",
  },
];

export const STUDIO_PAGES: readonly ContextualStudioPage[] = [
  {
    href: HOME_HREF,
    label: "North Star",
    bucket: "foundations",
    surface: "vision",
    status: "active",
    blurb: "The Contextual product boundary and operating thesis.",
    source: ["docs/ENG-contextual-platform.md"],
  },
  ...presentations.map((presentation) => ({
    href: presentation.href,
    label: `${presentation.id} - ${presentation.title}`,
    bucket: "presentations" as const,
    surface: "engineering" as const,
    status: presentation.status,
    blurb: presentation.summary,
    source: presentation.source,
  })),
  ...studies.map((study) => ({
    href: study.href,
    label: study.title,
    bucket: "studies" as const,
    surface: "design" as const,
    status: study.status,
    blurb: study.summary,
    source: study.source,
  })),
];

export const registry = createRegistry<StudioBucket, StudioSurface, StudioStatus>({
  pages: STUDIO_PAGES,
  surfaceOrder: ["vision", "engineering", "design"],
  defaultSurface: "engineering",
  bucketLabel,
  surfaceLabel,
});

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
  { key: "presentations", title: "CTH Presentations" },
  { key: "studies" },
] as const;

export function bucketLabel(bucket: StudioBucket): string {
  switch (bucket) {
    case "foundations":
      return "Foundations";
    case "presentations":
      return "Presentations";
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
    case "design":
      return "Design";
  }
}

export function normalizeStudioPath(pathname: string | null): string {
  if (!pathname || pathname === "/studio/") return HOME_HREF;
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}

export function presentationForHref(href: string): Presentation | undefined {
  return presentations.find((presentation) => presentation.href === href);
}

export function studyForHref(href: string): Study | undefined {
  return studies.find((study) => study.href === href);
}
