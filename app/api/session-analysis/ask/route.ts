import { NextResponse } from "next/server";
import type { SessionAnalysisAskRequest } from "@/lib/sessionAnalysis";
import { getSessionAnalysisAskResponse } from "@/server/session-analysis";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const demo = new URL(request.url).searchParams.get("demo") === "1";
    const body = (await request.json()) as SessionAnalysisAskRequest;
    return NextResponse.json(await getSessionAnalysisAskResponse(body, demo));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === "sessionId and question required" ? 400 : message.startsWith("unknown session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
