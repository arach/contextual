import { NextResponse } from "next/server";
import { getContextualRuntimeConfig } from "@/server/session-analysis";

export const runtime = "nodejs";

/** Lightweight runtime config the client reads on boot (e.g. forced demo mode). */
export async function GET() {
  return NextResponse.json(getContextualRuntimeConfig());
}
