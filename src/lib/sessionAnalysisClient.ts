import type {
  SessionAnalysisAskRequest,
  SessionAnalysisAskResponse,
  SessionAnalysisResponse,
  SessionCatalogResponse,
  SessionPullRequest,
  SessionPullResponse,
} from "@/lib/sessionAnalysis";

/** Appends `?demo=1` when demo mode is active so the server serves the curated corpus. */
function demoQuery(demo?: boolean): string {
  return demo ? "demo=1" : "";
}

export async function fetchSessionAnalysis(demo?: boolean): Promise<SessionAnalysisResponse> {
  const qs = demoQuery(demo);
  const res = await fetch(`/api/session-analysis${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`session analysis failed: ${res.status}`);
  return (await res.json()) as SessionAnalysisResponse;
}

export async function fetchSessionCatalog(params?: {
  q?: string;
  project?: string;
  limit?: number;
  demo?: boolean;
}): Promise<SessionCatalogResponse> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.project) search.set("project", params.project);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.demo) search.set("demo", "1");
  const qs = search.toString();
  const res = await fetch(`/api/session-analysis/catalog${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`session catalog failed: ${res.status}`);
  return (await res.json()) as SessionCatalogResponse;
}

export async function pullSessionAnalysis(
  request: SessionPullRequest,
  demo?: boolean,
): Promise<SessionPullResponse> {
  const qs = demoQuery(demo);
  const res = await fetch(`/api/session-analysis/pull${qs ? `?${qs}` : ""}`, {
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
  demo?: boolean,
): Promise<SessionAnalysisAskResponse> {
  const qs = demoQuery(demo);
  const res = await fetch(`/api/session-analysis/ask${qs ? `?${qs}` : ""}`, {
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
