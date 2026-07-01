import { NextResponse } from "next/server";

import { catalogHarnessSessions, parseHarnessId } from "@/server/harnesses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await catalogHarnessSessions({
      harness: parseHarnessId(url.searchParams.get("harness")),
      cwd: url.searchParams.get("cwd") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 80),
    });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
