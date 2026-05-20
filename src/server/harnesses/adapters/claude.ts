import { stat } from "node:fs/promises";
import { join } from "node:path";

import {
  HOME,
  contentToText,
  readAllJsonlAtRest,
  readJsonlAtRest,
  readTranscriptHead,
  projectSidecars,
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
  titleFromTranscriptMeta,
  titleFromUserMessage,
  type TranscriptSessionMeta,
} from "../../../lib/sessionLabel";

const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_FILES = 500;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const claudeAdapter: HarnessAdapter = {
  id: "claude",
  version: "claude-adapter@0.1.0",
  capabilities: {
    hasLoggedTurnContext: false,
    hasCompactionMarkers: true,
    hasWorkspaceSidecars: false,
    canFork: false,
    canReplayPayload: false,
  },
  async discover(opts: HarnessCatalogOptions = {}): Promise<HarnessSessionRef[]> {
    const files = await walkJsonlFiles(join(HOME, ".claude", "projects"), {
      maxAgeMs: MAX_AGE_MS,
      maxFiles: opts.limit ? Math.max(opts.limit * 2, 80) : MAX_FILES,
      maxDepth: 10,
    });
    const refs = await Promise.all(files.map((file) => inferClaudeSession(file.path, file.mtimeMs, file.sizeBytes)));
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
    return projectSidecars(ref.cwd, "claude", Boolean(opts?.includeContent));
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

async function inferClaudeSession(path: string, mtimeMs: number, sizeBytes: number): Promise<HarnessSessionRef> {
  let title = titleFromPath(path);
  let summary = "Discovered Claude Code transcript on disk.";
  let cwd = decodeClaudeProjectCwd(path);
  const nativeSessionId = path.match(UUID_RE)?.[0];

  try {
    const head = await readTranscriptHead(path);
    const meta = parseClaudeMeta(head, cwd);
    cwd = meta.cwd ?? cwd;
    const best = pickBestUserMessage(collectClaudeUserMessages(head));
    if (best) {
      title = titleFromUserMessage(best);
      summary = summaryFromUserMessage(best);
    } else {
      title = titleFromTranscriptMeta(meta, path);
    }
  } catch {
    // Keep path-based fallback metadata.
  }

  return {
    key: stableSessionKey("claude", path),
    harness: "claude",
    nativeSessionId,
    path,
    cwd,
    project: projectHintFromPath(cwd ?? path),
    title,
    summary,
    observedAt: new Date(mtimeMs).toISOString(),
    mtimeMs,
    sizeBytes,
  };
}

function parseClaudeMeta(jsonlHead: string, fallbackCwd?: string): TranscriptSessionMeta {
  const meta: TranscriptSessionMeta = { cwd: fallbackCwd, project: fallbackCwd ? projectHintFromPath(fallbackCwd) : undefined };
  for (const line of jsonlHead.split("\n").slice(0, 80)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Record<string, unknown>;
      const cwd = rec.cwd ?? rec.working_directory;
      if (typeof cwd === "string") {
        meta.cwd = cwd;
        meta.project = projectHintFromPath(cwd);
      }
    } catch {
      // Ignore malformed head lines.
    }
  }
  return meta;
}

function collectClaudeUserMessages(jsonlHead: string): string[] {
  const messages: string[] = [];
  for (const line of jsonlHead.split("\n").slice(0, 600)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Record<string, unknown>;
      if (rec.type !== "user") continue;
      const message = rec.message as Record<string, unknown> | undefined;
      const content = message?.content;
      if (Array.isArray(content) && content.every((part) => Boolean(part && typeof part === "object" && (part as Record<string, unknown>).type === "tool_result"))) {
        continue;
      }
      const text = contentToText(content).trim();
      if (text) messages.push(text);
    } catch {
      // Ignore malformed head lines.
    }
  }
  return messages;
}

function decodeClaudeProjectCwd(path: string): string | undefined {
  const match = path.match(/\.claude\/projects\/([^/]+)\//);
  if (!match?.[1]) return undefined;
  const encoded = match[1];
  if (!encoded.startsWith("-")) return encoded;
  return encoded.replace(/-/g, "/");
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
