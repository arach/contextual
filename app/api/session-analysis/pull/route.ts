import { NextResponse } from "next/server";
import type { SessionPullRequest } from "@/lib/sessionAnalysis";
import { pullSessionAnalysisResponse } from "@/server/session-analysis";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const demo = new URL(request.url).searchParams.get("demo") === "1";
    const body = (await request.json()) as SessionPullRequest;
    return NextResponse.json(await pullSessionAnalysisResponse(body, demo));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "path or paths required" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
