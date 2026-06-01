import type {
  EvalResult,
  HealthTone,
  LaunchTargetHarness,
  LoadProfileId,
  SourceState,
  TruthState,
} from "@/lib/contextCartridge";
import { tokFor } from "@/lib/tokens";
import type { ContextModule, Thread } from "@/types";

export type ContextResourceKind =
  | "recent-session"
  | "support-doc"
  | "tool-example"
  | "repo-map"
  | "manual-note";

export interface LocalContextResource {
  id: string;
  title: string;
  kind: ContextResourceKind;
  path: string;
  tags: string[];
  summary: string;
  usefulFor: string;
  tokens: number;
  truth: TruthState;
  state: SourceState;
  lastReviewed: string;
}

export type AgentResourceAction = "keep" | "compress" | "refresh" | "drop";

export interface AgentResourceSelection {
  resourceId: string;
  action: AgentResourceAction;
  slot: string;
  reason: string;
  outputTokens: number;
}

export interface ContextDraftPart {
  id: string;
  title: string;
  slot: string;
  body: string;
  sourceIds: string[];
  tokens: number;
  profileIds: LoadProfileId[];
  truth: TruthState;
}

export interface ContextDraftProfile {
  id: LoadProfileId;
  label: string;
  targetTokens: number;
  partIds: string[];
}

export interface ContextTestDriveCheck {
  id: string;
  label: string;
  tone: HealthTone;
  detail: string;
}

export interface ContextTestDriveScenario {
  id: string;
  prompt: string;
  expectedSignals: string[];
  result: EvalResult;
  notes: string;
}

export interface ContextTestDrive {
  target: LaunchTargetHarness;
  profileId: LoadProfileId;
  budget: number;
  checks: ContextTestDriveCheck[];
  scenarios: ContextTestDriveScenario[];
}

export interface AgentAssistedContextDraft {
  id: string;
  title: string;
  objective: string;
  target: LaunchTargetHarness;
  agent: {
    handle: string;
    instruction: string;
    summary: string;
  };
  resourceIds: string[];
  selections: AgentResourceSelection[];
  parts: ContextDraftPart[];
  profiles: ContextDraftProfile[];
  testDrive: ContextTestDrive;
}

export type ContextDesignProposalMode = "agent" | "heuristic";
export type ContextResourceEvidenceState = "loaded" | "metadata-only" | "missing";

export interface ContextResourceEvidence {
  resourceId: string;
  title: string;
  path: string;
  state: ContextResourceEvidenceState;
  chars: number;
  contentHash?: string;
  note?: string;
}

export interface ContextDesignProposalResponse {
  draft: AgentAssistedContextDraft;
  mode: ContextDesignProposalMode;
  generatedAt: string;
  evidence: ContextResourceEvidence[];
  warnings: string[];
  model?: string;
}

export interface DesignedSession {
  thread: Thread;
  modules: ContextModule[];
}

export interface ContextDesignAgentInput {
  title?: string;
  objective: string;
  target?: LaunchTargetHarness;
  profileId?: LoadProfileId;
}

const ACTION_OUTPUT_RATIO: Record<AgentResourceAction, number> = {
  keep: 0.32,
  compress: 0.16,
  refresh: 0.08,
  drop: 0.04,
};

const RESOURCE_SLOT_BY_KIND: Record<ContextResourceKind, string> = {
  "recent-session": "decision-ledger",
  "support-doc": "source-brief",
  "tool-example": "verification",
  "repo-map": "repo-map",
  "manual-note": "source-gap",
};

const RESOURCE_TAG_ALIASES: Record<string, string[]> = {
  agent: ["agent", "codex", "claude", "scout"],
  context: ["context", "cartridge", "planner", "launch", "fork"],
  session: ["recent-session", "session", "studio"],
  docs: ["support-material", "contract", "north-star"],
  tools: ["tools", "browser", "codex", "scout"],
};

export function resourcesForDraft(
  draft: AgentAssistedContextDraft,
  resources: readonly LocalContextResource[],
): LocalContextResource[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  return draft.resourceIds
    .map((resourceId) => byId.get(resourceId))
    .filter((resource): resource is LocalContextResource => Boolean(resource));
}

export function selectedResourcesForDraft(
  draft: AgentAssistedContextDraft,
  resources: readonly LocalContextResource[],
): Array<AgentResourceSelection & { resource: LocalContextResource }> {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  return draft.selections
    .map((selection) => {
      const resource = byId.get(selection.resourceId);
      return resource ? { ...selection, resource } : null;
    })
    .filter(
      (selection): selection is AgentResourceSelection & { resource: LocalContextResource } =>
        Boolean(selection),
    );
}

export function proposeAgentContextDraft(
  input: ContextDesignAgentInput,
  resources: readonly LocalContextResource[],
): AgentAssistedContextDraft {
  const objective = input.objective.trim() || "Create a tight starter session from useful local context.";
  const target = input.target ?? "codex";
  const title = input.title?.trim() || titleFromObjective(objective);
  const profileId = input.profileId ?? "working-set";

  const ranked = resources
    .map((resource) => ({ resource, score: scoreResourceForObjective(resource, objective) }))
    .sort((a, b) => b.score - a.score);
  const chosen = ranked.filter((item) => item.score > 0).slice(0, 8);
  const resourcesForPlan = chosen.length > 0 ? chosen : ranked.slice(0, 5);

  const selections = resourcesForPlan.map(({ resource, score }): AgentResourceSelection => {
    const action = actionForResource(resource, score);
    return {
      resourceId: resource.id,
      action,
      slot: slotForResource(resource),
      reason: reasonForSelection(action, objective),
      outputTokens: outputTokensFor(resource, action),
    };
  });

  const parts = draftPartsFromSelections({ objective, selections, resources });

  return buildAgentContextDraftFromSelections({
    input: { ...input, objective, target, profileId, title },
    resources,
    selections,
    parts,
  });
}

export function buildAgentContextDraftFromSelections({
  input,
  resources,
  selections,
  parts = draftPartsFromSelections({ objective: input.objective, selections, resources }),
  summary,
}: {
  input: ContextDesignAgentInput & { objective: string };
  resources: readonly LocalContextResource[];
  selections: readonly AgentResourceSelection[];
  parts?: ContextDraftPart[];
  summary?: string;
}): AgentAssistedContextDraft {
  const objective = input.objective.trim() || "Create a tight starter session from useful local context.";
  const target = input.target ?? "codex";
  const title = input.title?.trim() || titleFromObjective(objective);
  const profileId = input.profileId ?? "working-set";
  const selectedIds = selections.map((selection) => selection.resourceId);
  const profiles = profilesForParts(parts);
  const testDrive = testDriveForDraft({
    objective,
    target,
    profileId,
    parts,
    resources: resources.filter((resource) => selectedIds.includes(resource.id)),
  });

  return {
    id: slugify(title),
    title,
    objective,
    target,
    agent: {
      handle: "@context-planner",
      instruction:
        "Select useful local resources, compress stale or verbose material, preserve source truth labels, and block launch claims that are not source-backed.",
      summary: summary?.trim() || summarizeAgentPlan({ objective, selections, resources }),
    },
    resourceIds: selectedIds,
    selections: [...selections],
    parts,
    profiles,
    testDrive,
  };
}

export function partsForProfileDraft(
  draft: AgentAssistedContextDraft,
  profileId: LoadProfileId,
): ContextDraftPart[] {
  const profile = draft.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) return [];
  return profile.partIds
    .map((partId) => draft.parts.find((part) => part.id === partId))
    .filter((part): part is ContextDraftPart => Boolean(part));
}

export function profileDraftTokenTotal(
  draft: AgentAssistedContextDraft,
  profileId: LoadProfileId,
): number {
  return partsForProfileDraft(draft, profileId).reduce(
    (total, part) => total + part.tokens,
    0,
  );
}

export function compileContextPrompt(
  draft: AgentAssistedContextDraft,
  profileId: LoadProfileId = draft.testDrive.profileId,
): string {
  const parts = partsForProfileDraft(draft, profileId);
  const body = parts
    .map((part) => {
      return [
        `## ${part.title}`,
        `Slot: ${part.slot}`,
        `Truth: ${part.truth}`,
        `Sources: ${part.sourceIds.join(", ")}`,
        "",
        part.body,
      ].join("\n");
    })
    .join("\n\n");

  return [
    `# ${draft.title}`,
    "",
    `Objective: ${draft.objective}`,
    `Target: ${draft.target}`,
    `Agent: ${draft.agent.handle}`,
    "",
    "## Agent Instruction",
    draft.agent.instruction,
    "",
    body,
  ].join("\n");
}

export function buildDesignedSession(
  draft: AgentAssistedContextDraft,
  options: { now?: string; profileId?: LoadProfileId } = {},
): DesignedSession {
  const now = options.now ?? new Date().toISOString();
  const profileId = options.profileId ?? draft.testDrive.profileId;
  const parts = partsForProfileDraft(draft, profileId);
  const modules: ContextModule[] = parts.map((part) => ({
    id: `${draft.id}-${part.id}`,
    name: part.title,
    kind: part.truth === "logged" ? "doc" : part.truth === "manual" ? "rules" : "log",
    tokens: part.tokens,
    body: part.body,
  }));

  const testSummary = draft.testDrive.scenarios
    .map((scenario) => `${scenario.result.toUpperCase()}: ${scenario.prompt}`)
    .join("\n");

  const thread: Thread = {
    id: `${draft.id}-session`,
    name: draft.title,
    glyph: "CTX",
    lastActive: "just now",
    status: "live",
    branches: ["context-draft"],
    activeBranch: "context-draft",
    fixed: modules.map((module) => module.id),
    soft: [
      {
        id: `${draft.id}-agent-summary`,
        kind: "summary",
        age: "just now",
        tokens: tokFor(draft.agent.summary),
        title: "agent context plan",
        body: draft.agent.summary,
      },
      {
        id: `${draft.id}-test-drive`,
        kind: "tool",
        age: "just now",
        tokens: tokFor(testSummary),
        title: "test drive results",
        body: testSummary,
      },
    ],
    task: {
      id: `${draft.id}-task`,
      kind: "task",
      sticky: true,
      age: "now",
      tokens: tokFor(draft.objective),
      title: "current task",
      body: draft.objective,
    },
    composer:
      "Start by validating the loaded context. Identify stale or missing source claims before proposing implementation work.",
    turn: 1,
    fixedBudget: Math.max(8, Math.ceil(profileDraftTokenTotal(draft, profileId) / 1000) + 4),
    softKeep: 6,
    backendConfig: { backend: "pi-coding-agent" },
  };

  return {
    thread: {
      ...thread,
      lastActive: now.slice(0, 10) === "2026-06-01" ? "just now" : thread.lastActive,
    },
    modules,
  };
}

function scoreResourceForObjective(resource: LocalContextResource, objective: string): number {
  const haystack = `${resource.title} ${resource.summary} ${resource.usefulFor} ${resource.tags.join(" ")}`.toLowerCase();
  const terms = normalizeTerms(objective);
  let score = 0;

  for (const term of terms) {
    if (haystack.includes(term)) score += 3;
    for (const alias of RESOURCE_TAG_ALIASES[term] ?? []) {
      if (haystack.includes(alias)) score += 2;
    }
  }

  if (resource.state === "fresh") score += 3;
  if (resource.truth === "logged") score += 3;
  if (resource.kind === "tool-example") score += 2;
  if (resource.kind === "recent-session") score += 2;
  if (resource.state === "missing") score -= 1;
  return score;
}

function normalizeTerms(input: string): string[] {
  const stop = new Set([
    "a",
    "an",
    "and",
    "are",
    "for",
    "from",
    "have",
    "into",
    "of",
    "that",
    "the",
    "this",
    "with",
  ]);
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((term) => term.length > 2 && !stop.has(term)),
    ),
  );
}

function actionForResource(resource: LocalContextResource, score: number): AgentResourceAction {
  if (resource.state === "missing") return "drop";
  if (resource.state === "stale") return "refresh";
  if (resource.tokens > 9000 || score < 7) return "compress";
  return "keep";
}

function slotForResource(resource: LocalContextResource): string {
  if (resource.tags.includes("north-star")) return "north-star";
  if (resource.tags.includes("contract")) return "truth-contract";
  return RESOURCE_SLOT_BY_KIND[resource.kind];
}

function reasonForSelection(
  action: AgentResourceAction,
  objective: string,
): string {
  switch (action) {
    case "keep":
      return `Directly useful for "${objective}" and compact enough to keep close to source truth.`;
    case "compress":
      return `Useful but too verbose for the launch profile; compress to the decisions and source claims.`;
    case "refresh":
      return `Relevant but stale. Include only the warning unless refreshed before launch.`;
    case "drop":
      return `Too weak for a confident launch claim. Preserve the gap instead of loading the source.`;
  }
}

function outputTokensFor(resource: LocalContextResource, action: AgentResourceAction): number {
  return Math.max(120, Math.round(resource.tokens * ACTION_OUTPUT_RATIO[action]));
}

function draftPartsFromSelections({
  objective,
  selections,
  resources,
}: {
  objective: string;
  selections: readonly AgentResourceSelection[];
  resources: readonly LocalContextResource[];
}): ContextDraftPart[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const usable = selections.filter((selection) => selection.action !== "drop");
  const grouped = groupSelectionsBySlot(usable);
  const parts: ContextDraftPart[] = [];

  const northStar = grouped.get("north-star") ?? [];
  parts.push({
    id: "task-brief",
    title: "Task brief and boundary",
    slot: "task-brief",
    body:
      `Objective: ${objective}. Keep the context tight, source-backed, and explicit about what it does not know. Do not claim hidden provider continuity unless a source proves it.`,
    sourceIds: sourceIdsForSelections(northStar, "ctx-presentations"),
    tokens: 720,
    profileIds: ["briefing", "working-set", "deep-pack"],
    truth: "logged",
  });

  for (const [slot, slotSelections] of grouped) {
    if (slot === "north-star") continue;
    const sourceIds = slotSelections.map((selection) => selection.resourceId);
    const slotResources = sourceIds
      .map((id) => byId.get(id))
      .filter((resource): resource is LocalContextResource => Boolean(resource));
    const truth = strongestTruth(slotResources);
    const tokens = Math.max(
      360,
      Math.round(slotSelections.reduce((sum, selection) => sum + selection.outputTokens, 0) * 0.58),
    );
    parts.push({
      id: slugify(slot),
      title: titleForSlot(slot),
      slot,
      body: bodyForSlot(slot, slotResources, slotSelections),
      sourceIds,
      tokens,
      profileIds: profileIdsForSlot(slot),
      truth,
    });
  }

  if (!parts.some((part) => part.slot === "verification")) {
    parts.push({
      id: "verification",
      title: "Verification brief",
      slot: "verification",
      body:
        "Before launch, ask the context to explain its source gaps and run one dry prompt that should fail if the context overclaims hidden continuity.",
      sourceIds: [],
      tokens: 360,
      profileIds: ["briefing", "working-set", "deep-pack"],
      truth: "manual",
    });
  }

  return parts;
}

function groupSelectionsBySlot(selections: AgentResourceSelection[]): Map<string, AgentResourceSelection[]> {
  const grouped = new Map<string, AgentResourceSelection[]>();
  for (const selection of selections) {
    grouped.set(selection.slot, [...(grouped.get(selection.slot) ?? []), selection]);
  }
  return grouped;
}

function sourceIdsForSelections(selections: AgentResourceSelection[], fallbackId: string): string[] {
  const ids = selections.map((selection) => selection.resourceId);
  return ids.length > 0 ? ids : [fallbackId];
}

function strongestTruth(resources: readonly LocalContextResource[]): TruthState {
  if (resources.some((resource) => resource.truth === "logged")) return "logged";
  if (resources.some((resource) => resource.truth === "reconstructed")) return "reconstructed";
  if (resources.some((resource) => resource.truth === "inferred")) return "inferred";
  return "manual";
}

function profileIdsForSlot(slot: string): LoadProfileId[] {
  if (slot === "source-gap") return ["working-set", "deep-pack"];
  if (slot === "decision-ledger" || slot === "repo-map") return ["working-set", "deep-pack"];
  return ["briefing", "working-set", "deep-pack"];
}

function titleForSlot(slot: string): string {
  return slot
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function bodyForSlot(
  slot: string,
  resources: readonly LocalContextResource[],
  selections: readonly AgentResourceSelection[],
): string {
  const lines = resources.map((resource) => {
    const selection = selections.find((candidate) => candidate.resourceId === resource.id);
    return `${resource.title}: ${resource.summary} Action: ${selection?.action ?? "keep"}.`;
  });
  if (slot === "source-gap") {
    return `${lines.join(" ")} Treat these as warning material unless refreshed.`;
  }
  if (slot === "verification") {
    return `${lines.join(" ")} Use these as test-drive checks before creating the session.`;
  }
  return lines.join(" ");
}

function profilesForParts(parts: readonly ContextDraftPart[]): ContextDraftProfile[] {
  return [
    {
      id: "briefing",
      label: "Briefing",
      targetTokens: 4500,
      partIds: parts
        .filter((part) => part.profileIds.includes("briefing"))
        .map((part) => part.id),
    },
    {
      id: "working-set",
      label: "Working Set",
      targetTokens: 9000,
      partIds: parts
        .filter((part) => part.profileIds.includes("working-set"))
        .map((part) => part.id),
    },
    {
      id: "deep-pack",
      label: "Deep Pack",
      targetTokens: 18000,
      partIds: parts
        .filter((part) => part.profileIds.includes("deep-pack"))
        .map((part) => part.id),
    },
  ];
}

function testDriveForDraft({
  objective,
  target,
  profileId,
  parts,
  resources,
}: {
  objective: string;
  target: LaunchTargetHarness;
  profileId: LoadProfileId;
  parts: readonly ContextDraftPart[];
  resources: readonly LocalContextResource[];
}): ContextTestDrive {
  const tokenTotal = parts
    .filter((part) => part.profileIds.includes(profileId))
    .reduce((sum, part) => sum + part.tokens, 0);
  const hasSourceGap = resources.some((resource) => resource.state === "stale" || resource.state === "missing");
  const everyPartSourced = parts.every((part) => part.sourceIds.length > 0 || part.truth === "manual");

  return {
    target,
    profileId,
    budget: profileId === "briefing" ? 4500 : profileId === "deep-pack" ? 18000 : 9000,
    checks: [
      {
        id: "budget",
        label: "Budget",
        tone: tokenTotal <= 9000 ? "ok" : "warn",
        detail: `${titleForSlot(profileId)} draft compiles to ${tokenTotal.toLocaleString()} estimated tokens.`,
      },
      {
        id: "provenance",
        label: "Provenance",
        tone: everyPartSourced ? "ok" : "warn",
        detail: everyPartSourced
          ? "All launch-critical parts carry source ids or explicit manual truth labels."
          : "One or more parts need stronger source ids before launch.",
      },
      {
        id: "freshness",
        label: "Freshness",
        tone: hasSourceGap ? "warn" : "ok",
        detail: hasSourceGap
          ? "Some resources are stale or missing; launch can proceed only with visible warnings."
          : "Selected resources are fresh enough for the selected profile.",
      },
      {
        id: "continuity",
        label: "Continuity",
        tone: "ok",
        detail: "The test drive asks the agent to avoid hidden-state or native-fork claims without evidence.",
      },
    ],
    scenarios: [
      {
        id: "objective",
        prompt: `Summarize the context needed for: ${objective}`,
        expectedSignals: ["tight scope", "source-backed parts", "explicit omissions"],
        result: everyPartSourced ? "pass" : "warn",
        notes: "The response should name which resources were used and which were compressed.",
      },
      {
        id: "boundary",
        prompt: "Explain what this context must not claim.",
        expectedSignals: ["no hidden memory claims", "freshness warnings", "lineage labels"],
        result: "pass",
        notes: "This catches the common failure mode: pretending a launch preserves hidden provider state.",
      },
      {
        id: "source-gap",
        prompt: "Which source families need refresh before a deeper launch?",
        expectedSignals: ["stale sources", "missing sources", "blocked deep-pack claims"],
        result: hasSourceGap ? "warn" : "pass",
        notes: hasSourceGap
          ? "Warnings are expected because stale or missing resources were intentionally preserved."
          : "No refresh gate is expected for this resource set.",
      },
    ],
  };
}

function summarizeAgentPlan({
  objective,
  selections,
  resources,
}: {
  objective: string;
  selections: readonly AgentResourceSelection[];
  resources: readonly LocalContextResource[];
}): string {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const kept = selections.filter((selection) => selection.action === "keep").length;
  const compressed = selections.filter((selection) => selection.action === "compress").length;
  const warnings = selections.filter((selection) => selection.action === "refresh" || selection.action === "drop");
  const warningTitles = warnings
    .map((selection) => byId.get(selection.resourceId)?.title)
    .filter(Boolean)
    .join(", ");
  return [
    `For "${objective}", the agent keeps ${kept} resources close to source truth and compresses ${compressed} verbose resources into launch parts.`,
    warningTitles
      ? `Warnings remain for ${warningTitles}; those become source-gap checks instead of confident launch claims.`
      : "No refresh-gated sources were selected.",
  ].join(" ");
}

function titleFromObjective(objective: string): string {
  const words = normalizeTerms(objective).slice(0, 5);
  if (words.length === 0) return "Designed Context";
  return titleForSlot(words.join("-"));
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "designed-context";
}
