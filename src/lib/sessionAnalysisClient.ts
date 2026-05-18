import type {
  SessionAnalysisAskRequest,
  SessionAnalysisAskResponse,
  SessionAnalysisResponse,
} from "@/lib/sessionAnalysis";

export async function fetchSessionAnalysis(): Promise<SessionAnalysisResponse> {
  const res = await fetch("/api/session-analysis");
  if (!res.ok) throw new Error(`session analysis failed: ${res.status}`);
  return (await res.json()) as SessionAnalysisResponse;
}

export async function askSessionAnalysis(
  request: SessionAnalysisAskRequest,
): Promise<SessionAnalysisAskResponse> {
  const res = await fetch("/api/session-analysis/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(data.error ?? `session analysis ask failed: ${res.status}`);
  }
  return (await res.json()) as SessionAnalysisAskResponse;
}
