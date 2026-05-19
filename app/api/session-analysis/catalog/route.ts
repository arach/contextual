import { NextResponse } from "next/server";
import { getSessionCatalogResponse } from "@/server/session-analysis";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await getSessionCatalogResponse({
      q: url.searchParams.get("q") ?? "",
      project: url.searchParams.get("project") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 40),
    });
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
