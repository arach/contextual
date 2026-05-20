import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  HOME,
  contentToText,
  readAllJsonlAtRest,
  readJsonlAtRest,
  readTranscriptHead,
  sidecarFromPath,
  stableSessionKey,
  walkJsonlFiles,
} from "../at-rest";
import { buildManifestFromAtRest } from "../manifest";
import { listTurnsFromAtRest } from "../turns";
import type {
  AtRestReadOptions,
  AtRestReadResponse,
  HarnessAdapter,
  HarnessCatalogOptions,
  HarnessSessionRef,
  SidecarFile,
  SidecarOptions,
  TurnReadyManifest,
  TurnRecord,
} from "../types";
import {
  pickBestUserMessage,
  projectHintFromPath,
  summaryFromUserMessage,
  titleFromPath,
  titleFromUserMessage,
} from "../../../lib/sessionLabel";

const CONTEXTUAL_ROOT = join(HOME, ".contextual");
const SESSION_DIR = join(CONTEXTUAL_ROOT, "sessions");
const WORKSPACES_DIR = join(CONTEXTUAL_ROOT, "workspaces");
const MANIFEST_PATH = join(CONTEXTUAL_ROOT, "manifest.json");
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_FILES = 500;

interface PiManifest {
  branches?: Record<string, { sessionPath: string | null; forkFrom?: string | null }>;
}

export const piAdapter: HarnessAdapter = {
  id: "pi",
  version: "pi-adapter@0.1.0",
  capabilities: {
    hasLoggedTurnContext: false,
    hasCompactionMarkers: false,
    hasWorkspaceSidecars: true,
    canFork: true,
    canReplayPayload: true,
  },
  async discover(opts: HarnessCatalogOptions = {}): Promise<HarnessSessionRef[]> {
    const files = await walkJsonlFiles(SESSION_DIR, {
      maxAgeMs: MAX_AGE_MS,
      maxFiles: opts.limit ? Math.max(opts.limit * 2, 80) : MAX_FILES,
      maxDepth: 2,
    });
    const manifest = await loadPiManifest();
    const refs = await Promise.all(files.map((file) => inferPiSession(file.path, file.mtimeMs, file.sizeBytes, manifest)));
    return refs.filter((ref) => matchesCatalogOptions(ref, opts));
  },
  async open(ref: HarnessSessionRef): Promise<HarnessSessionRef> {
    const fileStat = await stat(ref.path);
    return { ...ref, mtimeMs: fileStat.mtimeMs, sizeBytes: fileStat.size, observedAt: new Date(fileStat.mtimeMs).toISOString() };
  },
  readAtRest(ref: HarnessSessionRef, opts?: AtRestReadOptions): Promise<AtRestReadResponse> {
    return readJsonlAtRest(ref, opts);
  },
  listSidecars(ref: HarnessSessionRef, opts?: SidecarOptions): Promise<SidecarFile[]> {
    return listPiSidecars(ref, Boolean(opts?.includeContent));
  },
  async listTurns(ref: HarnessSessionRef): Promise<TurnRecord[]> {
    return listTurnsFromAtRest(ref, await readAllJsonlAtRest(ref));
  },
  async buildManifest(ref: HarnessSessionRef, turn: "latest" | string | number, opts = {}): Promise<TurnReadyManifest> {
    const lines = await readAllJsonlAtRest(ref);
    const turns = listTurnsFromAtRest(ref, lines);
    const sidecars = await this.listSidecars(ref, { includeContent: opts.includeSidecarContent ?? true });
    return buildManifestFromAtRest(ref, lines, turns, sidecars, turn);
  },
};

async function inferPiSession(
  path: string,
  mtimeMs: number,
  sizeBytes: number,
  manifest: PiManifest,
): Promise<HarnessSessionRef> {
  let title = titleFromPath(path);
  let summary = "Discovered Pi session transcript on disk.";
  let cwd: string | undefined;
  let nativeSessionId: string | undefined;
  let parentSessionKey: string | undefined;

  try {
    const head = await readTranscriptHead(path);
    const meta = parsePiSessionMeta(head);
    cwd = meta.cwd;
    nativeSessionId = meta.id;
    if (meta.parentSession) parentSessionKey = stableSessionKey("pi", meta.parentSession);
    const best = pickBestUserMessage(collectPiUserMessages(head));
    if (best) {
      title = titleFromUserMessage(best);
      summary = summaryFromUserMessage(best);
    }
  } catch {
    // Keep path-based fallback metadata.
  }

  const branchInfo = branchInfoForSession(path, manifest);
  if (branchInfo?.forkFrom && !parentSessionKey) parentSessionKey = stableSessionKey("pi", branchInfo.forkFrom);

  return {
    key: stableSessionKey("pi", path),
    harness: "pi",
    nativeSessionId,
    path,
    cwd,
    project: projectHintFromPath(cwd ?? path),
    title,
    summary,
    parentSessionKey,
    observedAt: new Date(mtimeMs).toISOString(),
    mtimeMs,
    sizeBytes,
  };
}

function parsePiSessionMeta(jsonlHead: string): { id?: string; cwd?: string; parentSession?: string } {
  for (const line of jsonlHead.split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Record<string, unknown>;
      if (rec.type !== "session") return {};
      return {
        id: typeof rec.id === "string" ? rec.id : undefined,
        cwd: typeof rec.cwd === "string" ? rec.cwd : undefined,
        parentSession: typeof rec.parentSession === "string" ? rec.parentSession : undefined,
      };
    } catch {
      return {};
    }
  }
  return {};
}

function collectPiUserMessages(jsonlHead: string): string[] {
  const messages: string[] = [];
  for (const line of jsonlHead.split("\n").slice(0, 600)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Record<string, unknown>;
      const message = rec.message as Record<string, unknown> | undefined;
      if (rec.type !== "message" || message?.role !== "user") continue;
      const text = contentToText(message.content).trim();
      if (text) messages.push(text);
    } catch {
      // Ignore malformed head lines.
    }
  }
  return messages;
}

async function listPiSidecars(ref: HarnessSessionRef, includeContent: boolean): Promise<SidecarFile[]> {
  const sidecars: SidecarFile[] = [];
  const manifestSidecar = await sidecarFromPath(MANIFEST_PATH, "manifest", includeContent, true);
  if (manifestSidecar) sidecars.push(manifestSidecar);

  const manifest = await loadPiManifest();
  const threadId = threadIdForSession(ref.path, manifest) ?? ref.nativeSessionId;
  if (!threadId) return sidecars;

  const workspaceDir = join(WORKSPACES_DIR, threadId);
  const workspaceFiles = await listMarkdownFiles(workspaceDir);
  for (const relpath of workspaceFiles) {
    const fullPath = join(workspaceDir, relpath);
    const kind = relpath === "AGENTS.md" ? "agents" : relpath.startsWith(".pi/skills/") ? "skill" : "workspace-file";
    const sidecar = await sidecarFromPath(fullPath, kind, includeContent, true);
    if (sidecar) sidecars.push(sidecar);
  }
  return sidecars;
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (subdir: string): Promise<void> => {
    const dir = join(root, subdir);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relpath = subdir ? `${subdir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(relpath);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(relpath);
    }
  };
  await walk("");
  return out.sort((a, b) => a.localeCompare(b));
}

async function loadPiManifest(): Promise<PiManifest> {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as PiManifest;
  } catch {
    return { branches: {} };
  }
}

function branchInfoForSession(
  sessionPath: string,
  manifest: PiManifest,
): { key: string; sessionPath: string | null; forkFrom?: string | null } | null {
  for (const [key, value] of Object.entries(manifest.branches ?? {})) {
    if (value.sessionPath === sessionPath) return { key, ...value };
  }
  return null;
}

function threadIdForSession(sessionPath: string, manifest: PiManifest): string | undefined {
  const branch = branchInfoForSession(sessionPath, manifest);
  return branch?.key.split("::")[0];
}

function matchesCatalogOptions(ref: HarnessSessionRef, opts: HarnessCatalogOptions): boolean {
  if (opts.cwd && ref.cwd && ref.cwd !== opts.cwd) return false;
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    const hay = [ref.title, ref.summary, ref.path, ref.cwd, ref.project].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}
