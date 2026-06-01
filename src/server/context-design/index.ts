import { createHash } from "node:crypto";
import { stat, readFile, readdir } from "node:fs/promises";
import { join, normalize } from "node:path";

import {
  complete,
  getEnvApiKey,
  getModel,
  type AssistantMessage,
  type TextContent,
} from "@earendil-works/pi-ai";

import { LOCAL_CONTEXT_RESOURCES } from "@/data/contextResourceRepository";
import { getOAuthApiKey } from "@/lib/backends/oauth";
import {
  buildAgentContextDraftFromSelections,
  proposeAgentContextDraft,
  type AgentAssistedContextDraft,
  type AgentResourceAction,
  type AgentResourceSelection,
  type ContextDesignAgentInput,
  type ContextDesignProposalResponse,
  type ContextResourceEvidence,
  type ContextResourceEvidenceState,
  type LocalContextResource,
} from "@/lib/contextCreation";
import { formatAnalysisTokens, topAllocations } from "@/lib/sessionAnalysis";
import type { SessionAnalysis } from "@/lib/sessionAnalysis";
import {
  getSessionCatalogResponse,
  pullSessionAnalysisResponse,
} from "@/server/session-analysis";

const PROVIDER = "anthropic";
const MODEL_ID = "claude-sonnet-4-6";
const RESOURCE_EXCERPT_CHARS = 1800;
const MODEL_RESOURCE_EXCERPT_CHARS = 700;
const OAUTH_TIMEOUT_MS = 4000;
const MODEL_TIMEOUT_MS = 25000;
const RECENT_SESSION_LIMIT = 3;

type ResourceEvidenceInternal = ContextResourceEvidence & {
  excerpt?: string;
};

function extractText(content: AssistantMessage["content"]): string {
  return content
    .filter((item): item is TextContent => item.type === "text")
    .map((item) => item.text)
    .join("")
    .trim();
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => rejectPromise(new Error(`${label} timed out`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolvePromise(value);
      },
      (error) => {
        clearTimeout(timeout);
        rejectPromise(error);
      },
    );
  });
}

function expandResourcePath(path: string): string[] {
  if (path.includes("CTX-001..005")) {
    return [
      "docs/presentations/CTX-001-scope-and-boundary.md",
      "docs/presentations/CTX-002-the-cartridge.md",
      "docs/presentations/CTX-003-the-planner.md",
      "docs/presentations/CTX-004-evidence-and-health.md",
      "docs/presentations/CTX-005-launch-and-fork.md",
    ];
  }

  return path
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveLocalPath(path: string): string {
  const normalized = normalize(path).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.startsWith("context-data/")) {
    return join(process.cwd(), "context-data", normalized.slice("context-data/".length));
  }
  if (normalized.startsWith("docs/")) {
    return join(process.cwd(), "docs", normalized.slice("docs/".length));
  }
  throw new Error(`resource path outside context evidence roots: ${path}`);
}

function recentSessionQuery(resource: LocalContextResource): string {
  const contextualTag = resource.tags.find((tag) => tag === "contextual" || tag === "studio");
  if (contextualTag === "studio") return "contextual studio";
  if (contextualTag) return contextualTag;
  const pathHint = resource.path.split(/[\\/]/).filter(Boolean).at(-1);
  return pathHint && !pathHint.startsWith("~") ? pathHint : resource.title;
}

function sessionEvidenceExcerpt(sessions: readonly SessionAnalysis[]): string {
  return sessions
    .map((session) => {
      const snapshot = session.snapshots[session.snapshots.length - 1];
      const allocation = snapshot
        ? topAllocations(snapshot.allocations, 3)
            .map((item) => `${item.bucket}:${Math.round(item.tokens / Math.max(1, snapshot.coveredTokens) * 100)}%`)
            .join(", ")
        : "no snapshot";
      const blocks = session.recipeDraft.blocks
        .slice(0, 4)
        .map((block) => `- ${block.title}: ${block.summary}`)
        .join("\n");
      const insights = session.bucketInsights
        .slice(0, 4)
        .map((insight) => `- ${insight.bucket}: ${insight.summary}`)
        .join("\n");
      return [
        `# ${session.title}`,
        `Project: ${session.project}; source: ${session.source}; observed: ${session.observedAt}`,
        `Summary: ${session.summary}`,
        snapshot
          ? `Window: ${formatAnalysisTokens(snapshot.coveredTokens)} covered; allocation ${allocation}`
          : `Window: ${allocation}`,
        "Recipe blocks:",
        blocks || "- none",
        "Bucket insights:",
        insights || "- none",
      ].join("\n");
    })
    .join("\n\n")
    .slice(0, RESOURCE_EXCERPT_CHARS);
}

async function readRecentSessionEvidence(resource: LocalContextResource): Promise<ResourceEvidenceInternal> {
  try {
    const catalog = await getSessionCatalogResponse({
      q: recentSessionQuery(resource),
      limit: RECENT_SESSION_LIMIT,
    });
    const paths = catalog.entries.map((entry) => entry.path);
    if (!paths.length) {
      return {
        resourceId: resource.id,
        title: resource.title,
        path: resource.path,
        state: "missing",
        chars: 0,
        note: "No recent matching sessions found in the session-analysis catalog.",
      };
    }

    const pulled = await pullSessionAnalysisResponse({ paths });
    const excerpt = sessionEvidenceExcerpt(pulled.sessions);
    return {
      resourceId: resource.id,
      title: resource.title,
      path: resource.path,
      state: pulled.sessions.length > 0 ? "loaded" : "metadata-only",
      chars: excerpt.length,
      contentHash: excerpt ? hashContent(excerpt) : undefined,
      note:
        pulled.sessions.length > 0
          ? `Loaded ${pulled.sessions.length} recent session analysis record(s).`
          : `Matched ${paths.length} catalog row(s), but no analysis records were pulled.`,
      excerpt,
    };
  } catch (error) {
    return {
      resourceId: resource.id,
      title: resource.title,
      path: resource.path,
      state: "metadata-only",
      chars: 0,
      note: `Session-analysis evidence unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function readPathEvidence(resource: LocalContextResource, rawPath: string): Promise<ResourceEvidenceInternal> {
  if (rawPath.startsWith("~/")) {
    return {
      resourceId: resource.id,
      title: resource.title,
      path: rawPath,
      state: "metadata-only",
      chars: 0,
      note: "External user-local source pointer; not read by the context-design route yet.",
    };
  }

  const absolutePath = resolveLocalPath(rawPath);
  try {
    const info = await stat(absolutePath);
    if (info.isDirectory()) {
      const names = (await readdir(absolutePath)).slice(0, 16);
      return {
        resourceId: resource.id,
        title: resource.title,
        path: rawPath,
        state: "metadata-only",
        chars: 0,
        note: `Directory source; sampled ${names.length} entries.`,
        excerpt: names.join("\n"),
      };
    }

    const content = await readFile(absolutePath, "utf8");
    return {
      resourceId: resource.id,
      title: resource.title,
      path: rawPath,
      state: "loaded",
      chars: content.length,
      contentHash: hashContent(content),
      excerpt: content.slice(0, RESOURCE_EXCERPT_CHARS),
    };
  } catch (error) {
    return {
      resourceId: resource.id,
      title: resource.title,
      path: rawPath,
      state: "missing",
      chars: 0,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

async function loadResourceEvidence(
  resources: readonly LocalContextResource[],
): Promise<ResourceEvidenceInternal[]> {
  const evidence: ResourceEvidenceInternal[] = [];
  for (const resource of resources) {
    if (resource.kind === "recent-session") {
      evidence.push(await readRecentSessionEvidence(resource));
      continue;
    }

    const paths = expandResourcePath(resource.path);
    const pathEvidence = await Promise.all(paths.map((path) => readPathEvidence(resource, path)));
    const loaded = pathEvidence.filter((item) => item.state === "loaded");
    const metadata = pathEvidence.filter((item) => item.state === "metadata-only");
    const missing = pathEvidence.filter((item) => item.state === "missing");
    const excerpt = pathEvidence
      .map((item) => item.excerpt)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, RESOURCE_EXCERPT_CHARS);
    const chars = pathEvidence.reduce((total, item) => total + item.chars, 0);
    const contentHash = loaded.length
      ? hashContent(loaded.map((item) => item.contentHash ?? "").join("|"))
      : undefined;
    const state: ContextResourceEvidenceState =
      loaded.length > 0 ? "loaded" : metadata.length > 0 ? "metadata-only" : "missing";

    evidence.push({
      resourceId: resource.id,
      title: resource.title,
      path: resource.path,
      state,
      chars,
      contentHash,
      note: missing.length > 0 ? `${missing.length} referenced path(s) missing.` : undefined,
      excerpt,
    });
  }
  return evidence;
}

function publicEvidence(evidence: readonly ResourceEvidenceInternal[]): ContextResourceEvidence[] {
  return evidence.map(({ excerpt: _excerpt, ...item }) => item);
}

function buildAgentPrompt({
  input,
  resources,
  evidence,
  fallback,
}: {
  input: ContextDesignAgentInput;
  resources: readonly LocalContextResource[];
  evidence: readonly ResourceEvidenceInternal[];
  fallback: AgentAssistedContextDraft;
}): string {
  const resourceBriefs = resources.map((resource) => {
    const resourceEvidence = evidence.find((item) => item.resourceId === resource.id);
    return [
      `${resource.id} | ${resource.title}`,
      `kind=${resource.kind}; truth=${resource.truth}; sourceState=${resource.state}; loaded=${resourceEvidence?.state ?? "missing"}`,
      `use=${resource.usefulFor}`,
      `summary=${resource.summary}`,
      resourceEvidence?.excerpt
        ? `evidence=${resourceEvidence.excerpt.slice(0, MODEL_RESOURCE_EXCERPT_CHARS)}`
        : "evidence=unavailable",
    ].join("\n");
  });

  return [
    "You are Contextual's context planner agent.",
    "Return only strict JSON in this shape:",
    `{"summary":"one compact plan summary","selections":[{"resourceId":"id","action":"keep|compress|refresh|drop","slot":"slot-name","reason":"short reason","outputTokens":480}]}`,
    "Do not return the final draft. Contextual will compile your source-sculpt proposal into the draft.",
    "Keep source ids truthful. Do not invent resources, hidden provider memory, native fork continuity, or unsupported freshness claims.",
    "Use refresh/drop for stale or weak sources; keep the source gap visible instead of making confident claims.",
    "Prefer compact launch material over transcript replay. Token counts are estimates.",
    "",
    `Objective: ${input.objective}`,
    `Target: ${input.target ?? fallback.target}`,
    `Profile: ${input.profileId ?? fallback.testDrive.profileId}`,
    `Fallback selections to improve: ${fallback.selections.map((selection) => `${selection.resourceId}:${selection.action}/${selection.slot}`).join(", ")}`,
    "",
    "Available resources:",
    resourceBriefs.join("\n\n"),
  ].join("\n");
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function normalizeAgentSculptPatch(
  value: unknown,
  fallback: AgentAssistedContextDraft,
  resources: readonly LocalContextResource[],
): { summary?: string; selections: AgentResourceSelection[] } | null {
  const record = asRecord(value);
  if (!record) return null;
  const rawSelections = Array.isArray(record.selections) ? record.selections : [];
  const resourceIds = new Set(resources.map((resource) => resource.id));
  const fallbackById = new Map(fallback.selections.map((selection) => [selection.resourceId, selection]));
  const seen = new Set<string>();
  const selections: AgentResourceSelection[] = [];

  for (const item of rawSelections) {
    const selection = asRecord(item);
    if (!selection) continue;
    const resourceId = stringValue(selection.resourceId, "");
    if (!resourceIds.has(resourceId) || seen.has(resourceId)) continue;
    seen.add(resourceId);
    const fallbackSelection = fallbackById.get(resourceId);
    selections.push({
      resourceId,
      action: enumValue<AgentResourceAction>(
        selection.action,
        ["keep", "compress", "refresh", "drop"],
        fallbackSelection?.action ?? "compress",
      ),
      slot: stringValue(selection.slot, fallbackSelection?.slot ?? "source-brief"),
      reason: stringValue(selection.reason, fallbackSelection?.reason ?? "Selected by the planning agent."),
      outputTokens: numberValue(selection.outputTokens, fallbackSelection?.outputTokens ?? 480),
    });
  }

  if (selections.length === 0) return null;
  return {
    summary: stringValue(record.summary, fallback.agent.summary),
    selections,
  };
}

async function proposeWithModel({
  input,
  resources,
  evidence,
  fallback,
}: {
  input: ContextDesignAgentInput;
  resources: readonly LocalContextResource[];
  evidence: readonly ResourceEvidenceInternal[];
  fallback: AgentAssistedContextDraft;
}): Promise<{ draft: AgentAssistedContextDraft; model: string } | null> {
  if (process.env.CONTEXTUAL_CONTEXT_DESIGN_DISABLE_MODEL === "1") return null;
  const oauthKey = await withTimeout(
    getOAuthApiKey(PROVIDER),
    OAUTH_TIMEOUT_MS,
    "planner OAuth lookup",
  ).catch((error) => {
    console.warn(`[context-design] OAuth lookup skipped: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  const apiKey = oauthKey ?? getEnvApiKey(PROVIDER);
  if (!apiKey) return null;

  try {
    const model = getModel(PROVIDER as never, MODEL_ID as never);
    const message = await withTimeout(
      complete(
        model,
        {
          systemPrompt:
            "You are Contextual's context planner agent. Emit compact, source-backed JSON for a session launch. Preserve provenance and call out stale or missing sources.",
          messages: [
            {
              role: "user",
              content: buildAgentPrompt({ input, resources, evidence, fallback }),
              timestamp: Date.now(),
            },
          ],
        },
        { apiKey, cacheRetention: "short" },
      ),
      MODEL_TIMEOUT_MS,
      "planner model proposal",
    );
    const parsed = parseJsonObject(extractText(message.content));
    const patch = normalizeAgentSculptPatch(parsed, fallback, resources);
    if (!patch) return null;
    const draft = buildAgentContextDraftFromSelections({
      input: {
        ...input,
        objective: fallback.objective,
        target: input.target ?? fallback.target,
        profileId: input.profileId ?? fallback.testDrive.profileId,
        title: input.title ?? fallback.title,
      },
      resources,
      selections: patch.selections,
      summary: patch.summary,
    });
    return { draft, model: MODEL_ID };
  } catch (error) {
    console.warn(`[context-design] model proposal failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function proposeContextDesignResponse(
  input: ContextDesignAgentInput,
): Promise<ContextDesignProposalResponse> {
  const resources = LOCAL_CONTEXT_RESOURCES;
  const fallback = proposeAgentContextDraft(input, resources);
  const evidence = await loadResourceEvidence(resources);
  const agentProposal = await proposeWithModel({ input, resources, evidence, fallback });
  const warnings = evidence
    .filter((item) => item.state !== "loaded")
    .map((item) => `${item.title}: ${item.state}${item.note ? ` (${item.note})` : ""}`);

  return {
    draft: agentProposal?.draft ?? fallback,
    mode: agentProposal ? "agent" : "heuristic",
    model: agentProposal?.model,
    generatedAt: new Date().toISOString(),
    evidence: publicEvidence(evidence),
    warnings: agentProposal
      ? warnings
      : ["No model credentials were available or the model proposal failed; used deterministic planner fallback.", ...warnings],
  };
}
