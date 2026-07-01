import { NextResponse } from "next/server";

import { proposeContextDesignResponse } from "@/server/context-design";
import type { ContextDesignAgentInput } from "@/lib/contextCreation";
import type { LaunchTargetHarness, LoadProfileId } from "@/lib/contextDesign";

export const runtime = "nodejs";

const TARGETS = new Set<LaunchTargetHarness>(["codex", "claude", "opencode", "pi", "pi-ai"]);
const PROFILES = new Set<LoadProfileId>(["briefing", "working-set", "deep-pack"]);

function parseInput(value: unknown): ContextDesignAgentInput {
  if (!value || typeof value !== "object") {
    throw new Error("request body required");
  }
  const body = value as Record<string, unknown>;
  const objective = typeof body.objective === "string" ? body.objective.trim() : "";
  if (!objective) throw new Error("objective required");

  const target =
    typeof body.target === "string" && TARGETS.has(body.target as LaunchTargetHarness)
      ? (body.target as LaunchTargetHarness)
      : undefined;
  const profileId =
    typeof body.profileId === "string" && PROFILES.has(body.profileId as LoadProfileId)
      ? (body.profileId as LoadProfileId)
      : undefined;
  const title = typeof body.title === "string" ? body.title : undefined;

  return { objective, target, profileId, title };
}

export async function POST(request: Request) {
  try {
    const input = parseInput(await request.json());
    return NextResponse.json(await proposeContextDesignResponse(input));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "objective required" || message === "request body required" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
