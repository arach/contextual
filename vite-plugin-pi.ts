// Dev-only Vite plugin: routes the React app to the local `pi` CLI
// (`@mariozechner/pi-coding-agent`), with a manifest mapping each
// (threadId, branchId) pair to a pi session file. Three routes:
//
//   POST /api/pi/dispatch  { threadId, branchId, prompt, systemPrompt? }
//   POST /api/pi/branch    { threadId, fromBranchId, newBranchId }
//   GET  /api/pi/tree
//
// Session files live in ~/.contextual/sessions/ as JSONL (pi's native
// format). The manifest at ~/.contextual/manifest.json persists across
// dev-server restarts.
//
// Forking semantics: pi's --fork creates a new session file in
// --session-dir and cannot combine with --session. We capture the new
// path by snapshotting the directory before and after the call.

import type { Connect, Plugin } from "vite";
import type { ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const ROOT = path.join(os.homedir(), ".contextual");
const SESSION_DIR = path.join(ROOT, "sessions");
const MANIFEST = path.join(ROOT, "manifest.json");

interface Manifest {
  /** (threadId, branchId) → session file path (absolute). */
  branches: Record<string, { sessionPath: string | null; forkFrom?: string | null }>;
}

function key(threadId: string, branchId: string): string {
  return `${threadId}::${branchId}`;
}

async function loadManifest(): Promise<Manifest> {
  try {
    const raw = await fs.readFile(MANIFEST, "utf8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return { branches: {} };
  }
}

async function saveManifest(m: Manifest): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify(m, null, 2));
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(SESSION_DIR, { recursive: true });
}

/** Snapshot the session dir's file names so we can detect what pi just created. */
async function listSessionFiles(): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(SESSION_DIR);
    return new Set(entries.filter((f) => f.endsWith(".jsonl")));
  } catch {
    return new Set();
  }
}

interface RunOpts {
  prompt: string;
  sessionPath?: string | null;
  forkFrom?: string | null;
  systemPrompt?: string;
  provider?: string;
  model?: string;
}

interface RunResult {
  reply: string;
  sessionPath: string;
  forked: boolean;
}

/**
 * Run pi once. Returns the reply text plus the resolved session path. If
 * --fork was used (or no session existed), the new file is detected by
 * diffing the session directory before and after the call.
 */
async function runPi(opts: RunOpts): Promise<RunResult> {
  await ensureDirs();
  const before = await listSessionFiles();

  const args: string[] = ["-p", opts.prompt];
  let forked = false;

  if (opts.forkFrom) {
    args.push("--fork", opts.forkFrom);
    args.push("--session-dir", SESSION_DIR);
    forked = true;
  } else if (opts.sessionPath) {
    args.push("--session", opts.sessionPath);
  } else {
    args.push("--session-dir", SESSION_DIR);
  }

  const provider = opts.provider ?? process.env.CTX_PI_PROVIDER;
  const model = opts.model ?? process.env.CTX_PI_MODEL;
  if (provider) args.push("--provider", provider);
  if (model) args.push("--model", model);
  if (opts.systemPrompt) args.push("--system-prompt", opts.systemPrompt);

  const reply = await new Promise<string>((resolve, reject) => {
    const child = spawn("pi", args, {
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      err += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `pi exited with code ${code}`));
    });
  });

  let resolvedPath = opts.sessionPath ?? null;
  if (forked || !resolvedPath) {
    const after = await listSessionFiles();
    const created = [...after].filter((f) => !before.has(f));
    if (created.length > 0) {
      // Pick the most recently named file (timestamp-prefixed).
      created.sort();
      resolvedPath = path.join(SESSION_DIR, created[created.length - 1]);
    } else if (!resolvedPath) {
      throw new Error("pi did not create a session file");
    }
  }

  return { reply, sessionPath: resolvedPath, forked };
}

// ---- Tree / introspection -------------------------------------------------

interface SessionSummary {
  path: string;
  id: string;
  cwd: string;
  parentSession?: string;
  messageCount: number;
  userCount: number;
  assistantCount: number;
  firstUserText?: string;
  lastTimestamp: string;
  totalTokens: number;
  totalCost: number;
}

async function summarizeSession(p: string): Promise<SessionSummary | null> {
  try {
    const text = await fs.readFile(p, "utf8");
    const lines = text.split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    const header = JSON.parse(lines[0]);
    if (header.type !== "session") return null;

    let messageCount = 0;
    let userCount = 0;
    let assistantCount = 0;
    let firstUserText: string | undefined;
    let lastTimestamp: string = header.timestamp;
    let totalTokens = 0;
    let totalCost = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const node = JSON.parse(lines[i]);
        if (node.timestamp) lastTimestamp = node.timestamp;
        if (node.type !== "message") continue;
        messageCount++;
        const m = node.message;
        if (m?.role === "user") {
          userCount++;
          if (!firstUserText) {
            const first = (m.content || []).find(
              (c: { type?: string }) => c.type === "text",
            );
            if (first?.text) firstUserText = first.text.slice(0, 80);
          }
        } else if (m?.role === "assistant") {
          assistantCount++;
          const u = m.usage;
          if (u?.totalTokens) totalTokens += u.totalTokens;
          if (u?.cost?.total) totalCost += u.cost.total;
        }
      } catch {
        // skip malformed lines
      }
    }

    return {
      path: p,
      id: header.id,
      cwd: header.cwd,
      parentSession: header.parentSession,
      messageCount,
      userCount,
      assistantCount,
      firstUserText,
      lastTimestamp,
      totalTokens,
      totalCost,
    };
  } catch {
    return null;
  }
}

async function gatherTree(): Promise<{
  sessions: SessionSummary[];
  branches: Record<string, { sessionPath: string | null; forkFrom?: string | null }>;
}> {
  await ensureDirs();
  const manifest = await loadManifest();
  const entries = await fs.readdir(SESSION_DIR);
  const sessions: SessionSummary[] = [];
  for (const f of entries) {
    if (!f.endsWith(".jsonl")) continue;
    const s = await summarizeSession(path.join(SESSION_DIR, f));
    if (s) sessions.push(s);
  }
  sessions.sort((a, b) => a.lastTimestamp.localeCompare(b.lastTimestamp));
  return { sessions, branches: manifest.branches };
}

// ---- HTTP handlers --------------------------------------------------------

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
  type Body = {
    threadId?: string;
    branchId?: string;
    prompt?: string;
    systemPrompt?: string;
  };
  const body = (await readBody(req)) as Body;
  if (!body.prompt || !body.threadId || !body.branchId) {
    return json(res, 400, { error: "threadId, branchId, prompt required" });
  }
  const t0 = Date.now();
  const manifest = await loadManifest();
  const slot = manifest.branches[key(body.threadId, body.branchId)] ?? {
    sessionPath: null,
  };
  console.log(
    `[pi] dispatch ${body.threadId}/${body.branchId} (session=${slot.sessionPath ?? "new"}${slot.forkFrom ? `, fork=${slot.forkFrom}` : ""})`,
  );
  try {
    const result = await runPi({
      prompt: body.prompt,
      sessionPath: slot.sessionPath,
      forkFrom: slot.forkFrom ?? undefined,
      systemPrompt: body.systemPrompt,
    });
    manifest.branches[key(body.threadId, body.branchId)] = {
      sessionPath: result.sessionPath,
      // forkFrom is consumed by the first dispatch — clear it so subsequent
      // calls go through --session as continuations.
      forkFrom: null,
    };
    await saveManifest(manifest);
    console.log(
      `[pi] reply in ${Date.now() - t0}ms (${result.reply.length} chars, session=${result.sessionPath})`,
    );
    json(res, 200, {
      reply: result.reply,
      sessionPath: result.sessionPath,
      forked: result.forked,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[pi] dispatch error: ${msg}`);
    json(res, 500, { error: msg });
  }
}

async function handleBranch(req: Connect.IncomingMessage, res: ServerResponse) {
  type Body = { threadId?: string; fromBranchId?: string; newBranchId?: string };
  const body = (await readBody(req)) as Body;
  if (!body.threadId || !body.fromBranchId || !body.newBranchId) {
    return json(res, 400, { error: "threadId, fromBranchId, newBranchId required" });
  }
  const manifest = await loadManifest();
  const parent = manifest.branches[key(body.threadId, body.fromBranchId)];
  manifest.branches[key(body.threadId, body.newBranchId)] = {
    sessionPath: null,
    forkFrom: parent?.sessionPath ?? null,
  };
  await saveManifest(manifest);
  console.log(
    `[pi] branch ${body.threadId}/${body.fromBranchId} → ${body.newBranchId} (parent=${parent?.sessionPath ?? "none"})`,
  );
  json(res, 200, {
    forkFrom: parent?.sessionPath ?? null,
    pending: parent?.sessionPath != null,
  });
}

async function handleTree(_req: Connect.IncomingMessage, res: ServerResponse) {
  try {
    const data = await gatherTree();
    json(res, 200, data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    json(res, 500, { error: msg });
  }
}

const handler: Connect.NextHandleFunction = (req, res, next) => {
  const url = (req.url ?? "").split("?")[0];
  if (req.method === "POST" && url === "/api/pi/dispatch") {
    void handleDispatch(req, res);
    return;
  }
  if (req.method === "POST" && url === "/api/pi/branch") {
    void handleBranch(req, res);
    return;
  }
  if (req.method === "GET" && url === "/api/pi/tree") {
    void handleTree(req, res);
    return;
  }
  next();
};

export function piPlugin(): Plugin {
  return {
    name: "vite-plugin-pi",
    configureServer(server) {
      // Make sure the storage dirs exist before the first request lands.
      fsSync.mkdirSync(SESSION_DIR, { recursive: true });
      server.middlewares.use(handler);
    },
  };
}
