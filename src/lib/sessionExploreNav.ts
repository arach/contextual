import type { SessionAnalysis, SessionCatalogEntry } from "@/lib/sessionAnalysis";

const PINNED_PATHS_KEY = "ctx.explorePinnedPaths";

export function readPinnedPaths(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_PATHS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

export function writePinnedPaths(paths: string[]): void {
  localStorage.setItem(PINNED_PATHS_KEY, JSON.stringify(paths));
}

export function pinPath(paths: string[], path: string): string[] {
  if (paths.includes(path)) return paths;
  return [path, ...paths];
}

export function unpinPath(paths: string[], path: string): string[] {
  return paths.filter((item) => item !== path);
}

export function mergeExploreSessions(
  corpus: SessionAnalysis[],
  pulled: SessionAnalysis[],
): SessionAnalysis[] {
  const byId = new Map<string, SessionAnalysis>();
  for (const session of [...corpus, ...pulled]) {
    byId.set(session.id, session);
  }
  return [...byId.values()];
}

export function sessionsForPinnedPaths(
  all: SessionAnalysis[],
  pinnedPaths: string[],
): SessionAnalysis[] {
  return pinnedPaths
    .map((path) => all.find((session) => session.path === path))
    .filter((session): session is SessionAnalysis => Boolean(session));
}

export function filterCatalogEntries(
  entries: SessionCatalogEntry[],
  query: string,
  project: SessionAnalysis["project"] | "all",
): SessionCatalogEntry[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return entries.filter((entry) => {
    if (project !== "all" && entry.project !== project) return false;
    if (!terms.length) return true;
    const hay = [entry.title, entry.summary, entry.path, entry.id, entry.project, entry.source]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}
