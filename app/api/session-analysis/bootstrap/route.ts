import { NextResponse } from "next/server";
import { getSessionBootstrapResponse } from "@/server/session-analysis";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getSessionBootstrapResponse());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
