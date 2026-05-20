import { NextResponse } from "next/server";

import { readHarnessAtRest } from "@/server/harnesses";

type RouteContext = { params: Promise<{ sessionKey: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  try {
    const { sessionKey } = await context.params;
    const url = new URL(request.url);
    return NextResponse.json(
      await readHarnessAtRest(decodeURIComponent(sessionKey), {
        fromLine: Number(url.searchParams.get("fromLine") ?? 1),
        limit: Number(url.searchParams.get("limit") ?? 200),
        includeRaw: url.searchParams.get("includeRaw") === "true",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("Unknown harness session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
