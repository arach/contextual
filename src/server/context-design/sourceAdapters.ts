import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { stat, readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";

import {
  type ContextResourceEvidence,
  type ContextResourceEvidenceState,
  type ContextSourceAdapterId,
  type ContextSourceVisibility,
  type LocalContextResource,
} from "@/lib/contextCreation";
import { formatAnalysisTokens, topAllocations } from "@/lib/sessionAnalysis";
import type { SessionAnalysis } from "@/lib/sessionAnalysis";
import {
  getSessionCatalogResponse,
  pullSessionAnalysisResponse,
} from "@/server/session-analysis";

const RESOURCE_EXCERPT_CHARS = 6000;
const RECENT_SESSION_LIMIT = 3;
const MEMORY_TREE_MAX_FILES = 40;
const MEMORY_FILE_SNIPPET_CHARS = 420;

export type ResourceEvidenceInternal = ContextResourceEvidence & {
  excerpt?: string;
};

interface ContextSourceAdapter {
  id: ContextSourceAdapterId;
  canRead(resource: LocalContextResource): boolean;
  read(resource: LocalContextResource): Promise<ResourceEvidenceInternal>;
}

interface PathEvidence {
  path: string;
  state: ContextResourceEvidenceState;
  chars: number;
  contentHash?: string;
  note?: string;
  excerpt?: string;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function slashPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function stripLeadingDotDot(path: string): string {
  return normalize(path).replace(/^(\.\.(\/|\\|$))+/, "");
}

function excerpt(content: string, limit = RESOURCE_EXCERPT_CHARS): string {
  return content.slice(0, limit);
}

function expandResourcePath(path: string): string[] {
  if (path.includes("CTX-001..005")) {
    return [
      "docs/presentations/CTX-001-scope-and-boundary.md",
      "docs/presentations/CTX-002-the-cartridge.md",
      "docs/presentations/CTX-003-the-planner.md",
      "docs/presentations/CTX-004-evidence-and-health.md",
      "docs/presentations/CTX-005-launch-and-fork.md",
    ];
  }

  return path
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveProjectEvidencePath(path: string): string {
  const normalized = stripLeadingDotDot(path);
  if (normalized.startsWith("context-data/")) {
    return join(
      /*turbopackIgnore: true*/ process.cwd(),
      "context-data",
      normalized.slice("context-data/".length),
    );
  }
  if (normalized.startsWith("docs/")) {
    return join(
      /*turbopackIgnore: true*/ process.cwd(),
      "docs",
      normalized.slice("docs/".length),
    );
  }
  throw new Error(`resource path outside context evidence roots: ${path}`);
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function directSessionPaths(path: string): string[] {
  return expandResourcePath(path)
    .map((item) => expandHome(item))
    .filter((item) => item.endsWith(".jsonl"));
}

function resolveFileMemoryPath(path: string): string {
  if (path.startsWith("memory://contextual/")) {
    return join(homedir(), ".contextual", "memory", path.slice("memory://contextual/".length));
  }
  if (path === "memory://contextual") {
    return join(homedir(), ".contextual", "memory");
  }

  const expanded = expandHome(path);
  if (isAbsolute(expanded)) return resolve(/*turbopackIgnore: true*/ expanded);
  const normalized = stripLeadingDotDot(expanded);
  if (normalized.startsWith("context-data/") || normalized.startsWith("docs/")) {
    return resolveProjectEvidencePath(normalized);
  }
  return join(homedir(), ".contextual", "memory", normalized);
}

function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content.trim() };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line
      .slice(colonIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && value) frontmatter[key] = value;
  }
  return { frontmatter, body: match[2].trim() };
}

function recentSessionQuery(resource: LocalContextResource): string {
  const contextualTag = resource.tags.find((tag) => tag === "contextual" || tag === "studio");
  if (contextualTag === "studio") return "contextual studio";
  if (contextualTag) return contextualTag;
  const pathHint = resource.path.split(/[\\/]/).filter(Boolean).at(-1);
  return pathHint && !pathHint.startsWith("~") ? pathHint : resource.title;
}

function atomEvidenceScore(atom: SessionAnalysis["atoms"][number], terms: readonly string[]): number {
  const haystack = `${atom.label} ${atom.summary} ${atom.excerpt ?? ""} ${atom.fileRefs.join(" ")}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 2;
  }
  if (atom.fileRefs.length) score += 4;
  if (atom.sourceType === "tool-output") score += 3;
  if (["codebase", "decisions", "verification", "environment"].includes(atom.bucket)) score += 2;
  if (/\b(final|summary|report|diff|package|swift|swiftui|project\.yml|resolved)\b/.test(haystack)) score += 2;
  if (/\b(final report|comprehensive summary|products \/ modules|presentational|boundary|boundaries)\b/.test(haystack)) {
    score += 10;
  }
  return score;
}

function sessionEvidenceAtoms(session: SessionAnalysis): string {
  const terms = [
    ...new Set(
      `${session.title} ${session.summary}`
        .toLowerCase()
        .split(/[^a-z0-9.]+/)
        .filter((term) => term.length >= 5)
        .slice(0, 24),
    ),
  ];
  const seen = new Set<string>();
  return session.atoms
    .map((atom) => ({ atom, score: atomEvidenceScore(atom, terms) }))
    .filter(({ atom, score }) => score > 0 && (atom.excerpt || atom.summary))
    .sort((a, b) => b.score - a.score)
    .filter(({ atom }) => {
      const key = atom.contentHash || `${atom.label}:${atom.summary}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map(({ atom }) => {
      const refs = atom.fileRefs.slice(0, 4).join(", ");
      return [
        `- ${atom.bucket} / ${atom.label}: ${(atom.excerpt || atom.summary).slice(0, 360)}`,
        refs ? `  refs: ${refs}` : "",
      ].filter(Boolean).join("\n");
    })
    .join("\n");
}

function sessionEvidenceExcerpt(sessions: readonly SessionAnalysis[]): string {
  return sessions
    .map((session) => {
      const snapshot = session.snapshots[session.snapshots.length - 1];
      const allocation = snapshot
        ? topAllocations(snapshot.allocations, 3)
            .map((item) => `${item.bucket}:${Math.round((item.tokens / Math.max(1, snapshot.coveredTokens)) * 100)}%`)
            .join(", ")
        : "no snapshot";
      const blocks = session.recipeDraft.blocks
        .slice(0, 4)
        .map((block) => `- ${block.title}: ${block.summary}`)
        .join("\n");
      const insights = session.bucketInsights
        .slice(0, 4)
        .map((insight) => `- ${insight.bucket}: ${insight.summary}`)
        .join("\n");
      const atoms = sessionEvidenceAtoms(session);
      return [
        `# ${session.title}`,
        `Project: ${session.project}; source: ${session.source}; observed: ${session.observedAt}`,
        `Summary: ${session.summary}`,
        snapshot
          ? `Window: ${formatAnalysisTokens(snapshot.coveredTokens)} covered; allocation ${allocation}`
          : `Window: ${allocation}`,
        "Representative atoms:",
        atoms || "- none",
        "Recipe blocks:",
        blocks || "- none",
        "Bucket insights:",
        insights || "- none",
      ].join("\n");
    })
    .join("\n\n")
    .slice(0, RESOURCE_EXCERPT_CHARS);
}

async function readProjectPathEvidence(
  rawPath: string,
): Promise<PathEvidence> {
  if (rawPath.startsWith("~/")) {
    return {
      path: rawPath,
      state: "metadata-only",
      chars: 0,
      note: "External user-local source pointer; not read by the local-file adapter.",
    };
  }

  const absolutePath = resolveProjectEvidencePath(rawPath);
  try {
    const info = await stat(absolutePath);
    if (info.isDirectory()) {
      const names = (await readdir(absolutePath)).slice(0, 16);
      return {
        path: rawPath,
        state: "metadata-only",
        chars: 0,
        note: `Directory source; sampled ${names.length} entries.`,
        excerpt: names.join("\n"),
      };
    }

    const content = await readFile(absolutePath, "utf8");
    return {
      path: rawPath,
      state: "loaded",
      chars: content.length,
      contentHash: hashContent(content),
      excerpt: excerpt(content),
    };
  } catch (error) {
    return {
      path: rawPath,
      state: "missing",
      chars: 0,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

async function collectMemoryMarkdownFiles(
  root: string,
  dir = root,
  files: string[] = [],
): Promise<string[]> {
  if (files.length >= MEMORY_TREE_MAX_FILES) return files;

  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return files;
  }

  const sorted = entries
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      if (a.name === "system") return -1;
      if (b.name === "system") return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of sorted) {
    if (files.length >= MEMORY_TREE_MAX_FILES) break;
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectMemoryMarkdownFiles(root, absolutePath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function readMemoryTreeEvidence(root: string, rawPath: string): Promise<PathEvidence> {
  const files = await collectMemoryMarkdownFiles(root);
  if (!files.length) {
    return {
      path: rawPath,
      state: "metadata-only",
      chars: 0,
      note: "Memory directory exists but no markdown files were found.",
      excerpt: "(empty memory tree)",
    };
  }

  let totalChars = 0;
  const lines: string[] = [];
  const hashes: string[] = [];

  for (const file of files) {
    const rel = slashPath(relative(root, file));
    const content = await readFile(file, "utf8").catch(() => "");
    if (!content) continue;
    totalChars += content.length;
    hashes.push(hashContent(content));
    const { frontmatter, body } = parseFrontmatter(content);
    const visibility = rel.startsWith("system/") ? "always" : "on-demand";
    const description = frontmatter.description ? ` - ${frontmatter.description}` : "";
    lines.push(`${rel} [${visibility}]${description}`);
    if (visibility === "always" && body) {
      lines.push(excerpt(body, MEMORY_FILE_SNIPPET_CHARS));
    }
  }

  return {
    path: rawPath,
    state: "loaded",
    chars: totalChars,
    contentHash: hashContent(hashes.join("|")),
    note:
      files.length >= MEMORY_TREE_MAX_FILES
        ? `Memory tree sampled first ${MEMORY_TREE_MAX_FILES} markdown files.`
        : `Memory tree loaded ${files.length} markdown file(s).`,
    excerpt: lines.join("\n\n").slice(0, RESOURCE_EXCERPT_CHARS),
  };
}

async function readFileMemoryPathEvidence(
  rawPath: string,
): Promise<PathEvidence> {
  const absolutePath = resolveFileMemoryPath(rawPath);
  try {
    const info = await stat(absolutePath);
    if (info.isDirectory()) {
      return readMemoryTreeEvidence(absolutePath, rawPath);
    }

    const content = await readFile(absolutePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(content);
    const description = frontmatter.description ? `description=${frontmatter.description}\n\n` : "";
    return {
      path: rawPath,
      state: "loaded",
      chars: content.length,
      contentHash: hashContent(content),
      excerpt: excerpt(`${description}${body || content}`),
    };
  } catch (error) {
    return {
      path: rawPath,
      state: "missing",
      chars: 0,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

function aggregatePathEvidence({
  resource,
  adapterId,
  visibility,
  pathEvidence,
}: {
  resource: LocalContextResource;
  adapterId: ContextSourceAdapterId;
  visibility?: ContextSourceVisibility;
  pathEvidence: readonly PathEvidence[];
}): ResourceEvidenceInternal {
  const loaded = pathEvidence.filter((item) => item.state === "loaded");
  const metadata = pathEvidence.filter((item) => item.state === "metadata-only");
  const missing = pathEvidence.filter((item) => item.state === "missing");
  const combinedExcerpt = pathEvidence
    .map((item) => item.excerpt)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, RESOURCE_EXCERPT_CHARS);
  const chars = pathEvidence.reduce((total, item) => total + item.chars, 0);
  const contentHash = loaded.length
    ? hashContent(loaded.map((item) => item.contentHash ?? "").join("|"))
    : undefined;
  const state: ContextResourceEvidenceState =
    loaded.length > 0 ? "loaded" : metadata.length > 0 ? "metadata-only" : "missing";
  const notes = [
    ...pathEvidence.flatMap((item) => item.note ? [item.note] : []),
    missing.length > 0 ? `${missing.length} referenced path(s) missing.` : undefined,
  ].filter(Boolean);

  return {
    resourceId: resource.id,
    title: resource.title,
    path: resource.path,
    adapterId,
    visibility,
    sourceRefs: pathEvidence.map((item) => item.path),
    state,
    chars,
    contentHash,
    note: notes.length ? [...new Set(notes)].join(" ") : undefined,
    excerpt: combinedExcerpt,
  };
}

const recentSessionAdapter: ContextSourceAdapter = {
  id: "recent-session",
  canRead: (resource) =>
    resource.sourceAdapter === "recent-session" || resource.kind === "recent-session",
  async read(resource): Promise<ResourceEvidenceInternal> {
    const directPaths = directSessionPaths(resource.path);
    if (directPaths.length) {
      try {
        const pulled = await pullSessionAnalysisResponse({ paths: directPaths });
        const evidenceExcerpt = sessionEvidenceExcerpt(pulled.sessions);
        return {
          resourceId: resource.id,
          title: resource.title,
          path: resource.path,
          adapterId: "recent-session",
          visibility: resource.visibility,
          sourceRefs: directPaths,
          state: pulled.sessions.length > 0 ? "loaded" : "missing",
          chars: evidenceExcerpt.length,
          contentHash: evidenceExcerpt ? hashContent(evidenceExcerpt) : undefined,
          note:
            pulled.sessions.length > 0
              ? `Loaded ${pulled.sessions.length} directly referenced session analysis record(s).`
              : "No directly referenced session analysis records were pulled.",
          excerpt: evidenceExcerpt,
        };
      } catch (error) {
        return {
          resourceId: resource.id,
          title: resource.title,
          path: resource.path,
          adapterId: "recent-session",
          visibility: resource.visibility,
          sourceRefs: directPaths,
          state: "metadata-only",
          chars: 0,
          note: `Direct session evidence unavailable: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    try {
      const catalog = await getSessionCatalogResponse({
        q: recentSessionQuery(resource),
        limit: RECENT_SESSION_LIMIT,
      });
      const paths = catalog.entries.map((entry) => entry.path);
      if (!paths.length) {
        return {
          resourceId: resource.id,
          title: resource.title,
          path: resource.path,
          adapterId: "recent-session",
          visibility: resource.visibility,
          state: "missing",
          chars: 0,
          note: "No recent matching sessions found in the session-analysis catalog.",
        };
      }

      const pulled = await pullSessionAnalysisResponse({ paths });
      const evidenceExcerpt = sessionEvidenceExcerpt(pulled.sessions);
      return {
        resourceId: resource.id,
        title: resource.title,
        path: resource.path,
        adapterId: "recent-session",
        visibility: resource.visibility,
        sourceRefs: paths,
        state: pulled.sessions.length > 0 ? "loaded" : "metadata-only",
        chars: evidenceExcerpt.length,
        contentHash: evidenceExcerpt ? hashContent(evidenceExcerpt) : undefined,
        note:
          pulled.sessions.length > 0
            ? `Loaded ${pulled.sessions.length} recent session analysis record(s).`
            : `Matched ${paths.length} catalog row(s), but no analysis records were pulled.`,
        excerpt: evidenceExcerpt,
      };
    } catch (error) {
      return {
        resourceId: resource.id,
        title: resource.title,
        path: resource.path,
        adapterId: "recent-session",
        visibility: resource.visibility,
        state: "metadata-only",
        chars: 0,
        note: `Session-analysis evidence unavailable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

const fileMemoryAdapter: ContextSourceAdapter = {
  id: "file-memory",
  canRead: (resource) =>
    resource.sourceAdapter === "file-memory" ||
    resource.kind === "file-memory" ||
    resource.path.startsWith("memory://"),
  async read(resource): Promise<ResourceEvidenceInternal> {
    const paths = expandResourcePath(resource.path);
    const pathEvidence = await Promise.all(paths.map((path) => readFileMemoryPathEvidence(path)));
    return aggregatePathEvidence({
      resource,
      adapterId: "file-memory",
      visibility: resource.visibility ?? "on-demand",
      pathEvidence,
    });
  },
};

const localFileAdapter: ContextSourceAdapter = {
  id: "local-file",
  canRead: () => true,
  async read(resource): Promise<ResourceEvidenceInternal> {
    const paths = expandResourcePath(resource.path);
    const pathEvidence = await Promise.all(paths.map((path) => readProjectPathEvidence(path)));
    return aggregatePathEvidence({
      resource,
      adapterId: "local-file",
      visibility: resource.visibility ?? "on-demand",
      pathEvidence,
    });
  },
};

const SOURCE_ADAPTERS: readonly ContextSourceAdapter[] = [
  recentSessionAdapter,
  fileMemoryAdapter,
  localFileAdapter,
];

function adapterForResource(resource: LocalContextResource): ContextSourceAdapter {
  if (resource.sourceAdapter) {
    const explicitAdapter = SOURCE_ADAPTERS.find((adapter) => adapter.id === resource.sourceAdapter);
    if (explicitAdapter) return explicitAdapter;
  }
  return SOURCE_ADAPTERS.find((adapter) => adapter.canRead(resource)) ?? localFileAdapter;
}

export async function loadResourceEvidence(
  resources: readonly LocalContextResource[],
): Promise<ResourceEvidenceInternal[]> {
  return Promise.all(
    resources.map((resource) => adapterForResource(resource).read(resource)),
  );
}

export function publicEvidence(
  evidence: readonly ResourceEvidenceInternal[],
): ContextResourceEvidence[] {
  return evidence.map(({ excerpt: _excerpt, ...item }) => item);
}
