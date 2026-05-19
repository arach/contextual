import type {
  SessionAnalysisAskRequest,
  SessionAnalysisAskResponse,
  SessionAnalysisResponse,
  SessionCatalogResponse,
  SessionPullRequest,
  SessionPullResponse,
} from "@/lib/sessionAnalysis";

export async function fetchSessionAnalysis(): Promise<SessionAnalysisResponse> {
  const res = await fetch("/api/session-analysis");
  if (!res.ok) throw new Error(`session analysis failed: ${res.status}`);
  return (await res.json()) as SessionAnalysisResponse;
}

export async function fetchSessionCatalog(params?: {
  q?: string;
  project?: string;
  limit?: number;
}): Promise<SessionCatalogResponse> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.project) search.set("project", params.project);
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await fetch(`/api/session-analysis/catalog${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`session catalog failed: ${res.status}`);
  return (await res.json()) as SessionCatalogResponse;
}

export async function pullSessionAnalysis(
  request: SessionPullRequest,
): Promise<SessionPullResponse> {
  const res = await fetch("/api/session-analysis/pull", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(data.error ?? `session pull failed: ${res.status}`);
  }
  return (await res.json()) as SessionPullResponse;
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
