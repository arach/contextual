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
  type LocalContextResource,
} from "@/lib/contextCreation";
import {
  loadResourceEvidence,
  publicEvidence,
  type ResourceEvidenceInternal,
} from "@/server/context-design/sourceAdapters";

const PROVIDER = "anthropic";
const MODEL_ID = "claude-sonnet-4-6";
const MODEL_RESOURCE_EXCERPT_CHARS = 700;
const OAUTH_TIMEOUT_MS = 4000;
const MODEL_TIMEOUT_MS = 25000;

function extractText(content: AssistantMessage["content"]): string {
  return content
    .filter((item): item is TextContent => item.type === "text")
    .map((item) => item.text)
    .join("")
    .trim();
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
      `adapter=${resourceEvidence?.adapterId ?? resource.sourceAdapter ?? "local-file"}; visibility=${resourceEvidence?.visibility ?? resource.visibility ?? "on-demand"}`,
      resourceEvidence?.sourceRefs?.length
        ? `sourceRefs=${resourceEvidence.sourceRefs.slice(0, 4).join(", ")}`
        : "sourceRefs=unavailable",
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
