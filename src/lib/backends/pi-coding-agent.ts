// pi-coding-agent backend — spawns the `pi` CLI per dispatch, with a manifest
// mapping (threadId, branchId) pairs to pi session files and per-thread
// workspaces holding AGENTS.md + .pi/skills/ for native skill discovery.
//
// Storage layout under ~/.contextual/:
//   sessions/          pi-managed JSONL session files
//   workspaces/<id>/   one per thread; pi runs with cwd=this
//     AGENTS.md          concat of kind=rules modules
//     .pi/skills/<n>.md  one per kind=doc|log module (frontmatter)
//   manifest.json      (threadId, branchId) → sessionPath + forkFrom

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type {
  Backend,
  BranchRequest,
  DispatchRequest,
  DispatchResult,
} from "./types";
import type { ContextModule } from "../../types";
import { pickBestUserMessage, titleFromUserMessage } from "../sessionLabel";

const ROOT = path.join(os.homedir(), ".contextual");
const SESSION_DIR = path.join(ROOT, "sessions");
const WORKSPACES_DIR = path.join(ROOT, "workspaces");
const MANIFEST = path.join(ROOT, "manifest.json");

interface Manifest {
  branches: Record<string, { sessionPath: string | null; forkFrom?: string | null }>;
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

async function materializeWorkspace(
  threadId: string,
  modules: ContextModule[],
): Promise<{ workspaceDir: string; files: MaterializedFile[] }> {
  const dir = workspacePathFor(threadId);
  const skillsDir = path.join(dir, ".pi", "skills");
  await fs.mkdir(skillsDir, { recursive: true });

  const rules = modules.filter((m) => m.kind === "rules");
  const docs = modules.filter((m) => m.kind === "doc" || m.kind === "log");

  const agents =
    rules.length === 0
      ? ""
      : [
          "# Contextual workspace",
          "",
          `Thread: \`${threadId}\` · synced from Contextual's Fixed zone.`,
          "",
          ...rules.flatMap((m) => [`## ${m.name}`, "", m.body.trim(), ""]),
        ].join("\n");

  const agentsPath = path.join(dir, "AGENTS.md");
  if (agents) {
    await fs.writeFile(agentsPath, agents + "\n");
  } else {
    await fs.rm(agentsPath, { force: true });
  }

  const wantedSkills = new Map<string, string>();
  for (const m of docs) {
    const name = safeName(m.name);
    const desc = m.body.replace(/\s+/g, " ").slice(0, 280).trim();
    const front =
      `---\nname: ${name}\ndescription: ${desc}\n---\n\n` +
      `# ${m.name}\n\n${m.body.trim()}\n`;
    wantedSkills.set(`${name}.md`, front);
  }
  for (const [file, content] of wantedSkills) {
    await fs.writeFile(path.join(skillsDir, file), content);
  }
  for (const existing of await fs.readdir(skillsDir).catch(() => [] as string[])) {
    if (!existing.endsWith(".md")) continue;
    if (!wantedSkills.has(existing)) {
      await fs.rm(path.join(skillsDir, existing), { force: true });
    }
  }

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

async function runPi(
  opts: RunOpts,
): Promise<{ reply: string; sessionPath: string; forked: boolean }> {
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

// ---- Backend implementation ----------------------------------------------

async function dispatch(req: DispatchRequest): Promise<DispatchResult> {
  if (req.config.backend !== "pi-coding-agent") {
    throw new Error(`pi-coding-agent backend received config for ${req.config.backend}`);
  }
  const manifest = await loadManifest();
  const slot = manifest.branches[key(req.threadId, req.branchId)] ?? {
    sessionPath: null,
  };

  const { workspaceDir, files } = await materializeWorkspace(req.threadId, req.fixed);

  const taskLine = req.task?.body.trim();
  const promptBody = taskLine
    ? `Current task: ${taskLine}\n\nUser: ${req.user}`
    : req.user;

  console.log(
    `[pi-coding-agent] dispatch ${req.threadId}/${req.branchId} (cwd=${workspaceDir}, files=${files.length}, session=${slot.sessionPath ?? "new"}${slot.forkFrom ? `, fork=${slot.forkFrom}` : ""})`,
  );

  const t0 = Date.now();
  const result = await runPi({
    prompt: promptBody,
    cwd: workspaceDir,
    sessionPath: slot.sessionPath,
    forkFrom: slot.forkFrom ?? undefined,
    systemPrompt: req.systemPrompt,
  });
  manifest.branches[key(req.threadId, req.branchId)] = {
    sessionPath: result.sessionPath,
    forkFrom: null,
  };
  await saveManifest(manifest);

  console.log(
    `[pi-coding-agent] reply in ${Date.now() - t0}ms (${result.reply.length} chars)`,
  );

  return {
    reply: result.reply,
    sessionPath: result.sessionPath,
    forkedFrom: result.forked ? slot.forkFrom ?? undefined : undefined,
    workspace: { dir: workspaceDir, files },
  };
}

async function branch(req: BranchRequest): Promise<{ pending: boolean }> {
  const manifest = await loadManifest();
  const parent = manifest.branches[key(req.threadId, req.fromBranchId)];
  manifest.branches[key(req.threadId, req.newBranchId)] = {
    sessionPath: null,
    forkFrom: parent?.sessionPath ?? null,
  };
  await saveManifest(manifest);
  console.log(
    `[pi-coding-agent] branch ${req.threadId}/${req.fromBranchId} → ${req.newBranchId} (parent=${parent?.sessionPath ?? "none"})`,
  );
  return { pending: parent?.sessionPath != null };
}

export const piCodingAgentBackend: Backend = {
  id: "pi-coding-agent",
  label: "pi · sessions",
  capabilities: {
    hasNativeSessions: true,
    hasOAuth: false,
    hasModelPicker: false,
    hasStreaming: false,
  },
  dispatch,
  branch,
};

// ---- Tree / introspection (exposed to HTTP layer) ------------------------

export interface SessionSummary {
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
    const userTexts: string[] = [];
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
          const parts = (m.content || []) as Array<{ type?: string; text?: string }>;
          const text = parts
            .filter((c) => c.type === "text" && c.text)
            .map((c) => c.text!)
            .join("\n")
            .trim();
          if (text) userTexts.push(text);
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

    const bestUser = pickBestUserMessage(userTexts);
    const firstUserText = bestUser ? titleFromUserMessage(bestUser) : undefined;

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

export async function gatherTree(): Promise<{
  sessions: SessionSummary[];
  branches: Record<string, { sessionPath: string | null; forkFrom?: string | null }>;
}> {
  await ensureDirs();
  const manifest = await loadManifest();
  const entries = await fs.readdir(SESSION_DIR).catch(() => [] as string[]);
  const sessions: SessionSummary[] = [];
  for (const f of entries) {
    if (!f.endsWith(".jsonl")) continue;
    const s = await summarizeSession(path.join(SESSION_DIR, f));
    if (s) sessions.push(s);
  }
  sessions.sort((a, b) => a.lastTimestamp.localeCompare(b.lastTimestamp));
  return { sessions, branches: manifest.branches };
}

export async function gatherWorkspace(
  threadId: string,
): Promise<{ workspaceDir: string; files: MaterializedFile[] }> {
  const dir = workspacePathFor(threadId);
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat) return { workspaceDir: dir, files: [] };
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
  return { workspaceDir: dir, files };
}

export function ensureBackendDirs(): void {
  fsSync.mkdirSync(SESSION_DIR, { recursive: true });
  fsSync.mkdirSync(WORKSPACES_DIR, { recursive: true });
}
