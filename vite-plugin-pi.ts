// Dev-only Vite plugin: routes the React app to the local `pi` CLI
// (`@mariozechner/pi-coding-agent`), with a manifest mapping each
// (threadId, branchId) pair to a pi session file, and per-thread workspaces
// holding AGENTS.md + .pi/skills/ so pi natively discovers Fixed context
// without it being re-stuffed into every prompt.
//
// Routes:
//   POST /api/pi/dispatch  { threadId, branchId, prompt, fixed, task?, systemPrompt? }
//   POST /api/pi/branch    { threadId, fromBranchId, newBranchId }
//   GET  /api/pi/tree
//   GET  /api/pi/workspace?threadId=…
//
// Storage layout under ~/.contextual/:
//   sessions/          pi-managed JSONL session files
//   workspaces/<id>/   one per thread; pi runs with cwd=this
//     AGENTS.md          concat of kind=rules modules (project context)
//     .pi/skills/<n>.md  one per kind=doc|log module (skills, frontmatter)
//   manifest.json      (threadId,branchId) → sessionPath + forkFrom

import type { Connect, Plugin } from "vite";
import type { ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const ROOT = path.join(os.homedir(), ".contextual");
const SESSION_DIR = path.join(ROOT, "sessions");
const WORKSPACES_DIR = path.join(ROOT, "workspaces");
const MANIFEST = path.join(ROOT, "manifest.json");

interface Manifest {
  branches: Record<string, { sessionPath: string | null; forkFrom?: string | null }>;
}

interface FixedModule {
  id: string;
  name: string;
  kind: "rules" | "doc" | "log";
  body: string;
}

function key(threadId: string, branchId: string): string {
  return `${threadId}::${branchId}`;
}

async function loadManifest(): Promise<Manifest> {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, "utf8")) as Manifest;
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
  await fs.mkdir(WORKSPACES_DIR, { recursive: true });
}

async function listSessionFiles(): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(SESSION_DIR);
    return new Set(entries.filter((f) => f.endsWith(".jsonl")));
  } catch {
    return new Set();
  }
}

// ---- Workspace materialization -------------------------------------------

/** Sanitize a module name down to pi's skill-name rules (a-z, 0-9, hyphen). */
function safeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

function workspacePathFor(threadId: string): string {
  return path.join(WORKSPACES_DIR, safeName(threadId));
}

interface MaterializedFile {
  relpath: string;
  bytes: number;
}

/**
 * Write the Fixed module set into a workspace pi will discover:
 *   AGENTS.md          ← concat of kind=rules modules
 *   .pi/skills/<n>.md  ← one per kind=doc|log, with frontmatter
 *
 * Stale files (modules that were removed) get cleaned up. Returns the file
 * listing so callers can show the user what's on disk.
 */
async function materializeWorkspace(
  threadId: string,
  modules: FixedModule[],
): Promise<{ workspaceDir: string; files: MaterializedFile[] }> {
  const dir = workspacePathFor(threadId);
  const skillsDir = path.join(dir, ".pi", "skills");
  await fs.mkdir(skillsDir, { recursive: true });

  const rules = modules.filter((m) => m.kind === "rules");
  const docs = modules.filter((m) => m.kind === "doc" || m.kind === "log");

  // ---- AGENTS.md (rules → always-on context file) ----------------------
  const agents =
    rules.length === 0
      ? ""
      : [
          "# Contextual workspace",
          "",
          `Thread: \`${threadId}\` · synced from Contextual's Fixed zone.`,
          "",
          ...rules.flatMap((m) => [
            `## ${m.name}`,
            "",
            m.body.trim(),
            "",
          ]),
        ].join("\n");

  const agentsPath = path.join(dir, "AGENTS.md");
  if (agents) {
    await fs.writeFile(agentsPath, agents + "\n");
  } else {
    await fs.rm(agentsPath, { force: true });
  }

  // ---- .pi/skills/<name>.md (doc + log → on-demand skills) -------------
  const wantedSkills = new Map<string, string>();
  for (const m of docs) {
    const name = safeName(m.name);
    const desc = m.body.replace(/\s+/g, " ").slice(0, 280).trim();
    const front =
      `---\nname: ${name}\ndescription: ${desc}\n---\n\n` +
      `# ${m.name}\n\n${m.body.trim()}\n`;
    wantedSkills.set(`${name}.md`, front);
  }
  // Write wanted skills.
  for (const [file, content] of wantedSkills) {
    await fs.writeFile(path.join(skillsDir, file), content);
  }
  // Clean up stale skills.
  for (const existing of await fs.readdir(skillsDir).catch(() => [] as string[])) {
    if (!existing.endsWith(".md")) continue;
    if (!wantedSkills.has(existing)) {
      await fs.rm(path.join(skillsDir, existing), { force: true });
    }
  }

  // ---- File listing for response --------------------------------------
  const files: MaterializedFile[] = [];
  if (agents) {
    files.push({ relpath: "AGENTS.md", bytes: Buffer.byteLength(agents) });
  }
  for (const [file, content] of wantedSkills) {
    files.push({
      relpath: path.posix.join(".pi", "skills", file),
      bytes: Buffer.byteLength(content),
    });
  }
  return { workspaceDir: dir, files };
}

// ---- Pi invocation -------------------------------------------------------

interface RunOpts {
  prompt: string;
  cwd: string;
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

  // Pi's skills follow progressive disclosure: descriptions live in the
  // system prompt, full SKILL.md bodies load only when the model invokes
  // `read`. Enable just that tool so doc/log modules become genuinely
  // available without exposing edit/write/bash.
  args.push("--tools", "read");

  const provider = opts.provider ?? process.env.CTX_PI_PROVIDER;
  const model = opts.model ?? process.env.CTX_PI_MODEL;
  if (provider) args.push("--provider", provider);
  if (model) args.push("--model", model);
  if (opts.systemPrompt) args.push("--append-system-prompt", opts.systemPrompt);

  const reply = await new Promise<string>((resolve, reject) => {
    const child = spawn("pi", args, {
      cwd: opts.cwd,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => {
      out += c.toString("utf8");
    });
    child.stderr.on("data", (c) => {
      err += c.toString("utf8");
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
    fixed?: FixedModule[];
    task?: string;
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

  // Materialize Fixed modules as files pi will auto-discover from cwd.
  const { workspaceDir, files } = await materializeWorkspace(
    body.threadId,
    body.fixed ?? [],
  );

  // Compose the user message — context files carry the standing rules; the
  // prompt only needs the current task + user input.
  const promptBody =
    body.task && body.task.trim()
      ? `Current task: ${body.task.trim()}\n\nUser: ${body.prompt}`
      : body.prompt;

  console.log(
    `[pi] dispatch ${body.threadId}/${body.branchId} (cwd=${workspaceDir}, files=${files.length}, session=${slot.sessionPath ?? "new"}${slot.forkFrom ? `, fork=${slot.forkFrom}` : ""})`,
  );
  try {
    const result = await runPi({
      prompt: promptBody,
      cwd: workspaceDir,
      sessionPath: slot.sessionPath,
      forkFrom: slot.forkFrom ?? undefined,
      systemPrompt: body.systemPrompt,
    });
    manifest.branches[key(body.threadId, body.branchId)] = {
      sessionPath: result.sessionPath,
      forkFrom: null,
    };
    await saveManifest(manifest);
    console.log(
      `[pi] reply in ${Date.now() - t0}ms (${result.reply.length} chars)`,
    );
    json(res, 200, {
      reply: result.reply,
      sessionPath: result.sessionPath,
      forked: result.forked,
      workspaceDir,
      files,
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
    json(res, 200, await gatherTree());
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
}

async function handleWorkspace(req: Connect.IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const threadId = url.searchParams.get("threadId");
  if (!threadId) return json(res, 400, { error: "threadId required" });
  const dir = workspacePathFor(threadId);
  try {
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat) return json(res, 200, { workspaceDir: dir, files: [] });
    const files: MaterializedFile[] = [];
    const walk = async (sub: string) => {
      const full = path.join(dir, sub);
      const entries = await fs.readdir(full).catch(() => [] as string[]);
      for (const name of entries) {
        const rel = path.posix.join(sub, name);
        const s = await fs.stat(path.join(dir, rel));
        if (s.isDirectory()) {
          await walk(rel);
        } else if (name.endsWith(".md")) {
          files.push({ relpath: rel, bytes: s.size });
        }
      }
    };
    await walk("");
    files.sort((a, b) => a.relpath.localeCompare(b.relpath));
    json(res, 200, { workspaceDir: dir, files });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
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
  if (req.method === "GET" && url === "/api/pi/workspace") {
    void handleWorkspace(req, res);
    return;
  }
  next();
};

export function piPlugin(): Plugin {
  return {
    name: "vite-plugin-pi",
    configureServer(server) {
      fsSync.mkdirSync(SESSION_DIR, { recursive: true });
      fsSync.mkdirSync(WORKSPACES_DIR, { recursive: true });
      server.middlewares.use(handler);
    },
  };
}
