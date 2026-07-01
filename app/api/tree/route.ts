import { NextResponse } from "next/server";

import { gatherTree } from "@/lib/backends/pi-coding-agent";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await gatherTree());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
