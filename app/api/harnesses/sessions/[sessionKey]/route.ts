import { NextResponse } from "next/server";

import { getHarnessSession } from "@/server/harnesses";

type RouteContext = { params: Promise<{ sessionKey: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionKey } = await context.params;
    return NextResponse.json(await getHarnessSession(decodeURIComponent(sessionKey)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("Unknown harness session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
