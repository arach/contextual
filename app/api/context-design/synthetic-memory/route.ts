import { NextResponse } from "next/server";

import type { LoadProfileId, LaunchTargetHarness } from "@/lib/contextDesign";
import {
  proposeSyntheticMemoryLessons,
  type SyntheticMemoryInput,
} from "@/server/context-design/syntheticMemory";

export const runtime = "nodejs";

const TARGETS = new Set<LaunchTargetHarness>(["codex", "claude", "opencode", "pi", "pi-ai"]);
const PROFILES = new Set<LoadProfileId>(["briefing", "working-set", "deep-pack"]);

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
  return items.length ? items : undefined;
}

function parseInput(value: unknown): SyntheticMemoryInput {
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
  const maxLessons =
    typeof body.maxLessons === "number" && Number.isFinite(body.maxLessons)
      ? body.maxLessons
      : undefined;
  const title = typeof body.title === "string" ? body.title : undefined;
  const resourceIds = parseStringArray(body.resourceIds);
  const sessionPaths = parseStringArray(body.sessionPaths);

  return { objective, target, profileId, title, maxLessons, resourceIds, sessionPaths };
}

export async function POST(request: Request) {
  try {
    const input = parseInput(await request.json());
    return NextResponse.json(await proposeSyntheticMemoryLessons(input));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "objective required" || message === "request body required" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
