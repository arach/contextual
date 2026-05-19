// Dev-only Vite plugin: routes /api/* requests to one of the registered
// Backend implementations. The Backend abstraction lives in
// src/lib/backends/types.ts; concrete implementations live alongside it.
//
// Routes:
//   POST /api/dispatch   body: DispatchRequest
//   POST /api/branch     body: BranchRequest
//   GET  /api/tree       pi-coding-agent only (Contextual manifest TBD)
//   GET  /api/workspace?threadId=…   pi-coding-agent only

import type { Connect, Plugin } from "vite";
import type { ServerResponse } from "node:http";

import {
  ensureBackendDirs,
  gatherTree,
  gatherWorkspace,
  piCodingAgentBackend,
} from "./src/lib/backends/pi-coding-agent";
import { piAiBackend } from "./src/lib/backends/pi-ai";
import { authStatus, loginProvider } from "./src/lib/backends/oauth";
import type {
  Backend,
  BranchRequest,
  DispatchRequest,
} from "./src/lib/backends/types";
import type {
  SessionAnalysisAskRequest,
  SessionPullRequest,
} from "./src/lib/sessionAnalysis";
import {
  getSessionAnalysisAskResponse,
  getSessionAnalysisResponse,
  getSessionCatalogResponse,
  pullSessionAnalysisResponse,
} from "./src/server/session-analysis";

const BACKENDS: Record<string, Backend> = {
  "pi-coding-agent": piCodingAgentBackend,
  "pi-ai": piAiBackend,
};

function readBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

async function handleDispatch(req: Connect.IncomingMessage, res: ServerResponse) {
  const body = (await readBody(req)) as DispatchRequest;
  if (!body.threadId || !body.branchId || !body.user || !body.config) {
    return json(res, 400, {
      error: "threadId, branchId, user, config required",
    });
  }
  const backend = BACKENDS[body.config.backend];
  if (!backend) {
    return json(res, 400, { error: `unknown backend: ${body.config.backend}` });
  }
  try {
    const result = await backend.dispatch(body);
    json(res, 200, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${body.config.backend}] dispatch error: ${msg}`);
    json(res, 500, { error: msg });
  }
}

async function handleBranch(req: Connect.IncomingMessage, res: ServerResponse) {
  const body = (await readBody(req)) as BranchRequest;
  if (!body.threadId || !body.fromBranchId || !body.newBranchId || !body.config) {
    return json(res, 400, {
      error: "threadId, fromBranchId, newBranchId, config required",
    });
  }
  const backend = BACKENDS[body.config.backend];
  if (!backend) {
    return json(res, 400, { error: `unknown backend: ${body.config.backend}` });
  }
  if (!backend.branch) {
    return json(res, 200, { pending: false });
  }
  try {
    const result = await backend.branch(body);
    json(res, 200, result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    json(res, 500, { error: msg });
  }
}

async function handleTree(_req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    json(res, 200, await gatherTree());
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleWorkspace(req: Connect.IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const threadId = url.searchParams.get("threadId");
  if (!threadId) return json(res, 400, { error: "threadId required" });
  try {
    json(res, 200, await gatherWorkspace(threadId));
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleOAuthStatus(_req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    json(res, 200, await authStatus());
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleOAuthLogin(req: Connect.IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const provider = url.searchParams.get("provider");
  if (!provider) return json(res, 400, { error: "provider required" });
  try {
    await loginProvider(provider);
    json(res, 200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[oauth] login error: ${msg}`);
    json(res, 500, { error: msg });
  }
}

async function handleSessionAnalysis(_req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    json(res, 200, await getSessionAnalysisResponse());
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleSessionCatalog(req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? "", "http://local");
    const body = await getSessionCatalogResponse({
      q: url.searchParams.get("q") ?? "",
      project: url.searchParams.get("project") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 40),
    });
    json(res, 200, body);
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleSessionPull(req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    const body = (await readBody(req)) as SessionPullRequest;
    json(res, 200, await pullSessionAnalysisResponse(body));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    json(res, msg === "path or paths required" ? 400 : 500, { error: msg });
  }
}

async function handleSessionAnalysisAsk(req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    const body = (await readBody(req)) as SessionAnalysisAskRequest;
    if (!body.sessionId || !body.question?.trim()) {
      return json(res, 400, { error: "sessionId and question required" });
    }
    json(res, 200, await getSessionAnalysisAskResponse(body));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.startsWith("unknown session:") ? 404 : msg === "session has no snapshots" ? 400 : 500;
    json(res, status, { error: msg });
  }
}

const handler: Connect.NextHandleFunction = (req, res, next) => {
  const url = (req.url ?? "").split("?")[0];
  if (req.method === "POST" && url === "/api/dispatch") {
    void handleDispatch(req, res);
    return;
  }
  if (req.method === "POST" && url === "/api/branch") {
    void handleBranch(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/tree") {
    void handleTree(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/workspace") {
    void handleWorkspace(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/oauth/status") {
    void handleOAuthStatus(req, res);
    return;
  }
  if (req.method === "POST" && url === "/api/oauth/login") {
    void handleOAuthLogin(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/session-analysis/catalog") {
    void handleSessionCatalog(req, res);
    return;
  }
  if (req.method === "POST" && url === "/api/session-analysis/pull") {
    void handleSessionPull(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/session-analysis") {
    void handleSessionAnalysis(req, res);
    return;
  }
  if (req.method === "POST" && url === "/api/session-analysis/ask") {
    void handleSessionAnalysisAsk(req, res);
    return;
  }
  next();
};

export function backendsPlugin(): Plugin {
  return {
    name: "vite-plugin-backends",
    configureServer(server) {
      ensureBackendDirs();
      server.middlewares.use(handler);
    },
  };
}
