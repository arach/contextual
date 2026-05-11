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
import type {
  Backend,
  BranchRequest,
  DispatchRequest,
} from "./src/lib/backends/types";

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
