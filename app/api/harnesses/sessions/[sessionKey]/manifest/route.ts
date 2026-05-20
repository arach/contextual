import { NextResponse } from "next/server";

import { buildHarnessManifest } from "@/server/harnesses";

type RouteContext = { params: Promise<{ sessionKey: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  try {
    const { sessionKey } = await context.params;
    const url = new URL(request.url);
    return NextResponse.json(
      await buildHarnessManifest(decodeURIComponent(sessionKey), url.searchParams.get("turn") ?? "latest"),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("Unknown harness session") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
