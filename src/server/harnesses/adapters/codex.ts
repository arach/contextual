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

export const codexAdapter: HarnessAdapter = {
  id: "codex",
  version: "codex-adapter@0.1.0",
  capabilities: {
    hasLoggedTurnContext: true,
    hasCompactionMarkers: false,
    hasWorkspaceSidecars: false,
    canFork: false,
    canReplayPayload: false,
  },
  async discover(opts: HarnessCatalogOptions = {}): Promise<HarnessSessionRef[]> {
    const files = await walkJsonlFiles(join(HOME, ".codex", "sessions"), {
      maxAgeMs: MAX_AGE_MS,
      maxFiles: opts.limit ? Math.max(opts.limit * 2, 80) : MAX_FILES,
      maxDepth: 10,
    });
    const refs = await Promise.all(files.map((file) => inferCodexSession(file.path, file.mtimeMs, file.sizeBytes)));
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
    return projectSidecars(ref.cwd, "codex", Boolean(opts?.includeContent));
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

async function inferCodexSession(path: string, mtimeMs: number, sizeBytes: number): Promise<HarnessSessionRef> {
  let title = titleFromPath(path);
  let summary = "Discovered Codex session transcript on disk.";
  let cwd: string | undefined;
  let nativeSessionId = path.match(UUID_RE)?.[0];

  try {
    const head = await readTranscriptHead(path);
    const meta = parseCodexMeta(head);
    cwd = meta.cwd;
    nativeSessionId = meta.nativeSessionId ?? nativeSessionId;
    const best = pickBestUserMessage(collectCodexUserMessages(head));
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
    key: stableSessionKey("codex", path),
    harness: "codex",
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

function parseCodexMeta(jsonlHead: string): TranscriptSessionMeta & { nativeSessionId?: string } {
  const meta: TranscriptSessionMeta & { nativeSessionId?: string } = {};
  for (const line of jsonlHead.split("\n").slice(0, 80)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Record<string, unknown>;
      if (rec.type !== "session_meta") continue;
      const payload = rec.payload as Record<string, unknown> | undefined;
      if (typeof payload?.cwd === "string") meta.cwd = payload.cwd;
      if (typeof payload?.id === "string") meta.nativeSessionId = payload.id;
      const nick = payload?.agent_nickname;
      const role = payload?.agent_role;
      if (typeof nick === "string" || typeof role === "string") meta.agentLabel = [nick, role].filter(Boolean).join(" · ");
      meta.project = meta.cwd ? projectHintFromPath(meta.cwd) : undefined;
      break;
    } catch {
      // Ignore malformed head lines.
    }
  }
  return meta;
}

function collectCodexUserMessages(jsonlHead: string): string[] {
  const messages: string[] = [];
  for (const line of jsonlHead.split("\n").slice(0, 600)) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Record<string, unknown>;
      const payload = rec.payload as Record<string, unknown> | undefined;
      if (rec.type !== "response_item" || payload?.type !== "message" || payload.role !== "user") continue;
      const text = contentToText(payload.content).trim();
      if (text) messages.push(text);
    } catch {
      // Ignore malformed head lines.
    }
  }
  return messages;
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
