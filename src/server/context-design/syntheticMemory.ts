import { LOCAL_CONTEXT_RESOURCES } from "@/data/contextResourceRepository";
import {
  proposeAgentContextDraft,
  type ContextDesignAgentInput,
  type ContextResourceKind,
  type LocalContextResource,
} from "@/lib/contextCreation";
import type { EvalResult, LaunchTargetHarness, TruthState } from "@/lib/contextDesign";
import {
  loadResourceEvidence,
  type ResourceEvidenceInternal,
} from "@/server/context-design/sourceAdapters";
import { pullSessionAnalysisResponse } from "@/server/session-analysis";

export type SyntheticMemorySurface =
  | "agent-rule"
  | "memory"
  | "skill"
  | "package-part"
  | "source-gap";

export interface SyntheticMemoryInput extends ContextDesignAgentInput {
  maxLessons?: number;
  resourceIds?: string[];
  sessionPaths?: string[];
}

export interface SyntheticMemoryExercise {
  prompt: string;
  expectedSignals: string[];
  failureSignals: string[];
}

export interface SyntheticMemoryEval {
  result: EvalResult;
  reason: string;
  checks: Array<{
    id: "source-backed" | "scoped" | "actionable" | "not-overgeneralized";
    result: EvalResult;
    detail: string;
  }>;
}

export interface SyntheticMemoryLesson {
  id: string;
  title: string;
  surface: SyntheticMemorySurface;
  truth: TruthState;
  sourceIds: string[];
  sourceRefs: string[];
  appliesWhen: string;
  lesson: string;
  antiPattern: string;
  exercise: SyntheticMemoryExercise;
  evaluation: SyntheticMemoryEval;
  markdown: string;
}

export interface SyntheticMemoryResponse {
  mode: "heuristic";
  generatedAt: string;
  objective: string;
  lessons: SyntheticMemoryLesson[];
  notes: string[];
}

const DEFAULT_MAX_LESSONS = 4;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "synthetic-memory";
}

function clampLessonCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(8, Math.round(value)))
    : DEFAULT_MAX_LESSONS;
}

function selectedResources(
  input: SyntheticMemoryInput,
  resources: readonly LocalContextResource[],
): LocalContextResource[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const explicit = input.resourceIds
    ?.map((resourceId) => byId.get(resourceId))
    .filter((resource): resource is LocalContextResource => Boolean(resource));
  if (explicit?.length) return explicit;

  const draft = proposeAgentContextDraft(input, resources);
  return draft.resourceIds
    .map((resourceId) => byId.get(resourceId))
    .filter((resource): resource is LocalContextResource => Boolean(resource));
}

async function sessionResourcesFromPaths(paths: readonly string[]): Promise<LocalContextResource[]> {
  const uniquePaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  if (!uniquePaths.length) return [];

  const pulled = await pullSessionAnalysisResponse({ paths: uniquePaths });
  return pulled.sessions.map((session) => ({
    id: `session-${session.id}`,
    title: session.title,
    kind: "recent-session",
    path: session.path,
    sourceAdapter: "recent-session",
    visibility: "on-demand",
    tags: [
      "recent-session",
      "synthetic-memory",
      session.project.toLowerCase(),
      session.source,
      ...session.summary
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => ["swift", "ios", "macos", "hudson", "hudsonkit", "swiftui"].includes(term)),
    ],
    summary: session.summary,
    usefulFor:
      `Generating a scoped lesson from a ${session.project} ${session.source} session observed ${session.observedAt}.`,
    tokens: Math.min(session.contextTokens, 24_000),
    truth: "logged",
    state: "fresh",
    lastReviewed: new Date().toISOString().slice(0, 10),
  }));
}

function surfaceForResource(resource: LocalContextResource): SyntheticMemorySurface {
  if (resource.state === "stale" || resource.state === "missing") return "source-gap";
  if (resource.kind === "file-memory") return "memory";
  if (resource.kind === "tool-example") return "skill";
  if (resource.tags.includes("contract") || resource.tags.includes("north-star")) return "agent-rule";
  if (resource.kind === "recent-session") return "package-part";
  return "agent-rule";
}

function truthForSyntheticLesson(resource: LocalContextResource): TruthState {
  if (resource.truth === "logged") return "reconstructed";
  return resource.truth;
}

function kindNoun(kind: ContextResourceKind): string {
  switch (kind) {
    case "recent-session":
      return "prior-session evidence";
    case "file-memory":
      return "file-backed memory";
    case "support-doc":
      return "support documentation";
    case "tool-example":
      return "workflow example";
    case "repo-map":
      return "repository map";
    case "manual-note":
      return "manual note";
  }
}

function sourceRefsFor(resource: LocalContextResource, evidence?: ResourceEvidenceInternal): string[] {
  return evidence?.sourceRefs?.length ? evidence.sourceRefs : [resource.path];
}

function expectedSignals(resource: LocalContextResource, surface: SyntheticMemorySurface): string[] {
  const signals = [
    "names the source before applying the lesson",
    "states the scope where the lesson applies",
    "keeps freshness and truth labels visible",
  ];
  if (surface === "source-gap") {
    signals.push("treats the source as refresh-gated rather than authoritative");
  }
  if (surface === "skill") {
    signals.push("turns repeatable procedure into a skill or checklist");
  }
  if (resource.kind === "file-memory") {
    signals.push("separates always-loaded memory from on-demand memory");
  }
  return signals;
}

function failureSignals(surface: SyntheticMemorySurface): string[] {
  const signals = [
    "turns one episode into a universal rule",
    "drops source ids or provenance",
    "claims hidden provider memory or continuity without evidence",
  ];
  if (surface !== "source-gap") {
    signals.push("uses stale or missing evidence as a confident instruction");
  }
  return signals;
}

function specializedLessonForResource({
  objective,
  resource,
  evidence,
}: {
  objective: string;
  resource: LocalContextResource;
  evidence?: ResourceEvidenceInternal;
}): Partial<Pick<
  SyntheticMemoryLesson,
  "surface" | "appliesWhen" | "lesson" | "antiPattern"
>> | null {
  const haystack = `${resource.title} ${resource.summary} ${evidence?.excerpt ?? ""}`.toLowerCase();

  if (haystack.includes("hudphoneappshell") || haystack.includes("ios shell")) {
    return {
      surface: "agent-rule",
      appliesWhen:
        "A future agent is designing an iPhone shell with HudsonKit or deciding how much app chrome to replace.",
      lesson:
        "Start with `HudPhoneAppShell` and the Scout/Hudson theme bridge before touching feature views; use HudsonKit for shell, complications, tokens, and presentational primitives, while leaving app and broker logic in the app or shared Swift packages.",
      antiPattern:
        "Port macOS rail/overlay assumptions directly to iPhone or bury app behavior inside HudsonUI components.",
    };
  }

  if (haystack.includes("hudsonkit") && haystack.includes("integrated") && haystack.includes("project.yml")) {
    return {
      surface: "package-part",
      appliesWhen:
        "A future agent needs to verify whether HudsonKit is actually wired into a Swift iOS app.",
      lesson:
        "Verify HudsonKit adoption in four places: package declaration (`project.yml` or Package.swift), resolved package revision, root view imports/wrapper, and the theme/manifest bridge. Treat uncommitted project-file changes as integration state, not historical fact.",
      antiPattern:
        "Assume HudsonKit is absent because source files do not use many `Hud*` primitives yet, or assume it is fully shipped without checking git status and Package.resolved.",
    };
  }

  if (
    haystack.includes("hudsonui") &&
    (haystack.includes("presentational") ||
      haystack.includes("hudsonshell") ||
      haystack.includes("products / modules"))
  ) {
    return {
      surface: "agent-rule",
      appliesWhen:
        "A future agent is deciding whether Scout or Talkie logic should move into Hudson/HudsonKit.",
      lesson:
        "Keep HudsonUI as the presentational layer: rows, cards, message bars, badges, text documents, live indicators, theme tokens, and shell chrome. App-specific session, broker, and agent-copy behavior should stay in Scout/Talkie or shared app packages.",
      antiPattern:
        "Move product semantics into Hudson just because a Hudson primitive is visually close to the desired UI.",
    };
  }

  if (haystack.includes("shared-code baseline") || haystack.includes("scoutnativecore") || haystack.includes("mobilekeyboardkit")) {
    return {
      surface: "agent-rule",
      appliesWhen:
        "A future agent is extracting Swift code between macOS and iOS apps.",
      lesson:
        "Inventory existing shared Swift packages before creating new seams. For Scout, check `ScoutNativeCore`, `ScoutSharedUI`, and `MobileKeyboardKit` first, then decide whether HudsonKit should provide presentation only or whether app-level code belongs in the shared packages.",
      antiPattern:
        "Create a new shared package or move UI into Hudson before checking the current app/package dependency graph.",
    };
  }

  if (haystack.includes("recentrow") || haystack.includes("libraryrow") || haystack.includes("homefeed.swift")) {
    return {
      surface: "skill",
      appliesWhen:
        "A future agent is reviewing SwiftUI list/table rows across iOS homepage and library surfaces.",
      lesson:
        "Before abstracting SwiftUI row components, grep actual call sites and compare the data shape. If rows are private and single-use, prefer targeted cleanup over a shared abstraction; promote only the common rendering contract.",
      antiPattern:
        "Extract a shared row component because two screens look similar before proving shared data and interaction needs.",
    };
  }

  if (objective.toLowerCase().includes("hudsonkit") || objective.toLowerCase().includes("ios")) {
    return {
      surface: "memory",
      appliesWhen:
        `A future agent is ramping on "${objective}" and this session is selected as supporting evidence.`,
      lesson:
        "Use this session as scoped ramp material: capture the concrete file paths, package boundaries, and verification commands, then turn only the recurring behavior into a durable lesson.",
      antiPattern:
        "Persist the whole session summary as memory instead of extracting one reusable behavior with source refs.",
    };
  }

  return null;
}

function evaluateLesson({
  evidence,
  appliesWhen,
  lesson,
  surface,
}: {
  evidence?: ResourceEvidenceInternal;
  appliesWhen: string;
  lesson: string;
  surface: SyntheticMemorySurface;
}): SyntheticMemoryEval {
  const sourceBacked = evidence?.state === "loaded" && Boolean(evidence.sourceRefs?.length);
  const scopeText = `${appliesWhen} ${lesson}`.toLowerCase();
  const genericScope = /ramping on ".+" and this session is selected as supporting evidence/i.test(appliesWhen);
  const scoped = appliesWhen.trim().length >= 24 && !genericScope && scopeText.includes("future agent");
  const actionable = /\b(start|verify|check|keep|prefer|capture|treat|inventory|grep|use|do not|avoid)\b/i.test(
    lesson,
  );
  const notOvergeneralized = !lesson.toLowerCase().includes("always") || surface === "source-gap";

  const checks: SyntheticMemoryEval["checks"] = [
    {
      id: "source-backed",
      result: sourceBacked ? "pass" : "warn",
      detail: sourceBacked
        ? "The lesson has loaded evidence and source refs."
        : "The lesson needs loaded evidence before it should become a durable rule.",
    },
    {
      id: "scoped",
      result: scoped ? "pass" : "warn",
      detail: scoped
        ? "The lesson names its source and applies only in a bounded context."
        : "The lesson needs a sharper applicability condition.",
    },
    {
      id: "actionable",
      result: actionable ? "pass" : "warn",
      detail: actionable
        ? "The lesson gives a future agent an action to take or avoid."
        : "The lesson reads like a summary rather than a reusable behavior.",
    },
    {
      id: "not-overgeneralized",
      result: notOvergeneralized ? "pass" : "warn",
      detail: notOvergeneralized
        ? "The lesson avoids broad always-on behavior."
        : "The lesson overgeneralizes a source into a global rule.",
    },
  ];
  const warningCount = checks.filter((check) => check.result !== "pass").length;
  return {
    result: warningCount === 0 ? "pass" : warningCount <= 2 ? "warn" : "fail",
    reason:
      warningCount === 0
        ? "Safe as a candidate synthetic lesson; still requires human acceptance before persistence."
        : "Keep as a candidate until warnings are resolved or accepted deliberately.",
    checks,
  };
}

function renderMarkdown(lesson: Omit<SyntheticMemoryLesson, "markdown">): string {
  return [
    "---",
    `description: ${lesson.title}`,
    `surface: ${lesson.surface}`,
    `truth: ${lesson.truth}`,
    `sources: ${lesson.sourceIds.join(", ")}`,
    "---",
    "",
    `# ${lesson.title}`,
    "",
    `Applies when: ${lesson.appliesWhen}`,
    "",
    `Lesson: ${lesson.lesson}`,
    "",
    `Do not: ${lesson.antiPattern}`,
    "",
    "Practice prompt:",
    lesson.exercise.prompt,
    "",
    `Expected signals: ${lesson.exercise.expectedSignals.join("; ")}`,
    `Failure signals: ${lesson.exercise.failureSignals.join("; ")}`,
  ].join("\n");
}

function buildLesson({
  objective,
  resource,
  evidence,
}: {
  objective: string;
  resource: LocalContextResource;
  evidence?: ResourceEvidenceInternal;
}): SyntheticMemoryLesson {
  const specialized = specializedLessonForResource({ objective, resource, evidence });
  const surface = specialized?.surface ?? surfaceForResource(resource);
  const sourceRefs = sourceRefsFor(resource, evidence);
  const appliesWhen =
    specialized?.appliesWhen ??
    (surface === "source-gap"
      ? `A future session wants to use ${resource.title}, but the source is ${resource.state}.`
      : `A future session is working on "${objective}" and ${resource.title} is relevant source material.`);
  const lesson =
    specialized?.lesson ??
    (surface === "source-gap"
      ? `When ${resource.title} appears useful, preserve it as a visible refresh gate; do not upgrade it into a confident rule until the source is loaded and reviewed.`
      : `When ${resource.title} is selected from ${kindNoun(resource.kind)}, keep the resulting behavior scoped to the source and prefer a mini-rule with source refs over a broad memory summary.`);
  const antiPattern =
    specialized?.antiPattern ??
    (surface === "source-gap"
      ? "Treat a stale or missing source as authoritative because it sounds relevant."
      : "Generalize one source into an always-on instruction without an exercise that catches misuse.");
  const exercise: SyntheticMemoryExercise = {
    prompt: `A future agent is preparing context for "${objective}". It sees ${resource.title}. Decide whether to apply the lesson, cite the source refs, and name what would make the lesson unsafe.`,
    expectedSignals: expectedSignals(resource, surface),
    failureSignals: failureSignals(surface),
  };
  const draftLesson = {
    id: `synthetic-${slugify(resource.id)}`,
    title: `Synthetic lesson from ${resource.title}`,
    surface,
    truth: truthForSyntheticLesson(resource),
    sourceIds: [resource.id],
    sourceRefs,
    appliesWhen,
    lesson,
    antiPattern,
    exercise,
    evaluation: {
      result: "warn" as EvalResult,
      reason: "",
      checks: [],
    },
  };
  const evaluation = evaluateLesson({ evidence, appliesWhen, lesson, surface });
  const completed = { ...draftLesson, evaluation };
  return {
    ...completed,
    markdown: renderMarkdown(completed),
  };
}

export async function proposeSyntheticMemoryLessons(
  input: SyntheticMemoryInput,
): Promise<SyntheticMemoryResponse> {
  const objective = input.objective.trim();
  if (!objective) throw new Error("objective required");

  const target: LaunchTargetHarness = input.target ?? "codex";
  const sessionResources = await sessionResourcesFromPaths(input.sessionPaths ?? []);
  const resources = sessionResources.length
    ? sessionResources
    : selectedResources({ ...input, target }, LOCAL_CONTEXT_RESOURCES);
  const maxLessons = clampLessonCount(input.maxLessons);
  const evidence = await loadResourceEvidence(resources);
  const evidenceById = new Map(evidence.map((item) => [item.resourceId, item]));
  const lessons = resources
    .slice(0, maxLessons)
    .map((resource) =>
      buildLesson({
        objective,
        resource,
        evidence: evidenceById.get(resource.id),
      }),
    );

  return {
    mode: "heuristic",
    generatedAt: new Date().toISOString(),
    objective,
    lessons,
    notes: [
      "Synthetic lessons are candidates, not committed memory.",
      "Persist only after a human or evaluator accepts the lesson and its exercise.",
      "Use checked-in rules or package parts for required behavior; use generated memories as recall evidence.",
    ],
  };
}
