import { NextResponse } from "next/server";
import { getSessionBootstrapResponse } from "@/server/session-analysis";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const demo = new URL(request.url).searchParams.get("demo") === "1";
    return NextResponse.json(await getSessionBootstrapResponse(demo));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
