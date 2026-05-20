import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import type {
  AtRestLine,
  AtRestReadOptions,
  AtRestReadResponse,
  HarnessId,
  HarnessSessionRef,
  SidecarFile,
} from "./types";

const JSONL_PAGE_LIMIT = 1_000;

export const HOME = process.env.HOME ?? "/Users/arach";

export function stableHash(input: string, length = 24): string {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}

export function stableSessionKey(harness: HarnessId, path: string): string {
  return `${harness}-${stableHash(`${harness}:${path}`)}`;
}

export function sidecarId(path: string): string {
  return `sidecar-${stableHash(path)}`;
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function clampJsonlLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 200;
  return Math.min(JSONL_PAGE_LIMIT, Math.max(1, Math.floor(Number(limit))));
}

export async function readTranscriptHead(path: string, maxBytes = 65_536): Promise<string> {
  const buffer = await readFile(path);
  return buffer.subarray(0, Math.min(buffer.byteLength, maxBytes)).toString("utf8");
}

export async function walkJsonlFiles(
  root: string,
  opts: { maxAgeMs?: number; maxFiles?: number; maxDepth?: number } = {},
): Promise<Array<{ path: string; mtimeMs: number; sizeBytes: number }>> {
  const cutoffMs = opts.maxAgeMs ? Date.now() - opts.maxAgeMs : null;
  const out: Array<{ path: string; mtimeMs: number; sizeBytes: number }> = [];
  const maxDepth = opts.maxDepth ?? 10;

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (cutoffMs && shouldSkipDatedCodexDir(dir, entry.name, cutoffMs)) continue;
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        try {
          const fileStat = await stat(fullPath);
          if (cutoffMs && fileStat.mtimeMs < cutoffMs) continue;
          out.push({ path: fullPath, mtimeMs: fileStat.mtimeMs, sizeBytes: fileStat.size });
        } catch {
          // Ignore unreadable files.
        }
      }
    }
  };

  await walk(root, 0);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, opts.maxFiles ?? 500);
}

function shouldSkipDatedCodexDir(dir: string, dirName: string, cutoffMs: number): boolean {
  if (!dir.includes(join(".codex", "sessions"))) return false;
  const cutoff = new Date(cutoffMs);
  const parts = dir.split("/");

  if (/^\d{4}$/.test(dirName)) return Number(dirName) < cutoff.getFullYear();

  if (/^\d{2}$/.test(dirName) && /\/\d{4}$/.test(dir)) {
    const year = Number(parts[parts.length - 1]);
    const month = Number(dirName);
    if (year < cutoff.getFullYear()) return true;
    return year === cutoff.getFullYear() && month < cutoff.getMonth() + 1;
  }

  if (/^\d{2}$/.test(dirName) && /\/\d{4}\/\d{2}$/.test(dir)) {
    const day = Number(dirName);
    const month = Number(parts[parts.length - 1]);
    const year = Number(parts[parts.length - 2]);
    return new Date(year, month - 1, day, 23, 59, 59, 999).getTime() < cutoffMs;
  }

  return false;
}

export async function readJsonlAtRest(
  session: HarnessSessionRef,
  opts: AtRestReadOptions = {},
): Promise<AtRestReadResponse> {
  const fromLine = Math.max(1, Math.floor(Number(opts.fromLine ?? 1)));
  const limit = clampJsonlLimit(opts.limit);
  const includeRaw = Boolean(opts.includeRaw);
  const raw = await readFile(session.path, "utf8");
  const physicalLines = raw.split(/\r?\n/);
  const totalLines = physicalLines.reduce((count, line) => count + (line.trim() ? 1 : 0), 0);
  const lines: AtRestLine[] = [];
  let byteOffset = 0;
  let emittedAfterPage = false;

  for (let index = 0; index < physicalLines.length; index += 1) {
    const lineNo = index + 1;
    const line = physicalLines[index] ?? "";
    const separatorBytes = index < physicalLines.length - 1 ? 1 : 0;
    const currentByteOffset = byteOffset;
    byteOffset += Buffer.byteLength(line, "utf8") + separatorBytes;

    if (!line.trim() || lineNo < fromLine) continue;
    if (lines.length >= limit) {
      emittedAfterPage = true;
      break;
    }

    const native = parseJsonLine(line);
    const recordType = recordTypeFor(session.harness, native);
    const source = {
      kind: "jsonl" as const,
      path: session.path,
      line: lineNo,
      byteOffset: currentByteOffset,
      recordType,
    };
    lines.push({
      sessionKey: session.key,
      line: lineNo,
      byteOffset: currentByteOffset,
      recordType,
      timestamp: timestampFor(native),
      role: roleFor(session.harness, native),
      native,
      raw: includeRaw ? line : undefined,
      source,
    });
  }

  const nextFromLine = emittedAfterPage && lines.length ? (lines[lines.length - 1]?.line ?? fromLine) + 1 : null;
  return { session, fromLine, limit, totalLines, nextFromLine, lines };
}

function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return { type: "invalid_json", raw: line };
  }
}


export async function readAllJsonlAtRest(session: HarnessSessionRef): Promise<AtRestLine[]> {
  const lines: AtRestLine[] = [];
  let fromLine = 1;
  while (true) {
    const page = await readJsonlAtRest(session, { fromLine, limit: JSONL_PAGE_LIMIT, includeRaw: false });
    lines.push(...page.lines);
    if (!page.nextFromLine) break;
    fromLine = page.nextFromLine;
  }
  return lines;
}

export function recordTypeFor(harness: HarnessId, native: unknown): string {
  if (!native || typeof native !== "object") return "unknown";
  const rec = native as Record<string, unknown>;
  if (typeof rec.type === "string") return rec.type;
  if (harness === "codex") {
    const payload = rec.payload as Record<string, unknown> | undefined;
    if (typeof payload?.type === "string") return payload.type;
  }
  return "unknown";
}

export function roleFor(
  harness: HarnessId,
  native: unknown,
): "system" | "developer" | "user" | "assistant" | "tool" | "unknown" {
  if (!native || typeof native !== "object") return "unknown";
  const rec = native as Record<string, unknown>;

  if (harness === "codex") {
    const payload = rec.payload as Record<string, unknown> | undefined;
    if (payload?.role === "system" || payload?.role === "developer" || payload?.role === "user" || payload?.role === "assistant") {
      return payload.role;
    }
    if (payload?.type === "function_call" || payload?.type === "function_call_output") return "tool";
    return rec.type === "turn_context" ? "developer" : "unknown";
  }

  if (harness === "claude") {
    if (rec.type === "system") return "system";
    if (rec.type === "user") return "user";
    if (rec.type === "assistant") return "assistant";
    if (rec.type === "attachment") return "user";
    return "unknown";
  }

  if (harness === "pi") {
    const message = rec.message as Record<string, unknown> | undefined;
    if (message?.role === "system" || message?.role === "user" || message?.role === "assistant") return message.role;
    return rec.type === "session" ? "system" : "unknown";
  }

  return "unknown";
}

export function timestampFor(native: unknown): string | undefined {
  if (!native || typeof native !== "object") return undefined;
  const rec = native as Record<string, unknown>;
  const direct = rec.timestamp ?? rec.created_at ?? rec.createdAt;
  if (typeof direct === "string") return direct;
  const message = rec.message as Record<string, unknown> | undefined;
  if (typeof message?.timestamp === "string") return message.timestamp;
  return undefined;
}

export function contentToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const rec = part as Record<string, unknown>;
      const text = rec.text ?? rec.content ?? rec.thinking ?? rec.summary;
      if (typeof text === "string") return text;
      if (Array.isArray(text)) return contentToText(text);
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function nativeMessageText(harness: HarnessId, native: unknown): string {
  if (!native || typeof native !== "object") return "";
  const rec = native as Record<string, unknown>;

  if (harness === "codex") {
    const payload = rec.payload as Record<string, unknown> | undefined;
    return contentToText(payload?.content ?? payload?.output ?? payload?.arguments ?? payload?.text ?? "");
  }

  if (harness === "claude") {
    const message = rec.message as Record<string, unknown> | undefined;
    return contentToText(message?.content ?? rec.content ?? "");
  }

  const message = rec.message as Record<string, unknown> | undefined;
  return contentToText(message?.content ?? rec.content ?? "");
}

export async function sidecarFromPath(
  path: string,
  kind: SidecarFile["kind"],
  includeContent = false,
  includedByDefault = true,
): Promise<SidecarFile | null> {
  try {
    const fileStat = await stat(path);
    if (!fileStat.isFile()) return null;
    const content = await readFile(path, "utf8");
    return {
      id: sidecarId(path),
      kind,
      path,
      bytes: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      hash: stableHash(content, 40),
      includedByDefault,
      content: includeContent ? content : undefined,
    };
  } catch {
    return null;
  }
}

export async function projectSidecars(
  cwd: string | undefined,
  harness: HarnessId,
  includeContent = false,
): Promise<SidecarFile[]> {
  if (!cwd) return [];
  const candidates = harness === "claude"
    ? [
        { path: join(cwd, "CLAUDE.md"), kind: "claude-md" as const },
        { path: join(cwd, "AGENTS.md"), kind: "agents" as const },
      ]
    : [{ path: join(cwd, "AGENTS.md"), kind: "agents" as const }];

  const sidecars = await Promise.all(
    candidates.map((candidate) => sidecarFromPath(candidate.path, candidate.kind, includeContent)),
  );
  return sidecars.filter((sidecar): sidecar is SidecarFile => Boolean(sidecar));
}

export function basenameWithoutJsonl(path: string): string {
  return basename(path).replace(/\.jsonl$/i, "");
}

export function parentDirName(path: string): string {
  return basename(dirname(path));
}
