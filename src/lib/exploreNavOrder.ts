import type { SessionCatalogEntry } from "@/lib/sessionAnalysis";
import { sortCatalogByObserved } from "@/lib/sessionExplore";

export const EXPLORE_NAV_LIMIT = 28;

/** When two paths resolve to the same session id, keep the most recently observed. */
export function dedupeCatalogEntriesById(
  entries: SessionCatalogEntry[],
): SessionCatalogEntry[] {
  const byId = new Map<string, SessionCatalogEntry>();
  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (!existing || Date.parse(entry.observedAt) >= Date.parse(existing.observedAt)) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
}

/** Session ids in left-nav order: pinned first, then recent catalog entries. */
export function exploreSessionNavEntries(
  catalogEntries: SessionCatalogEntry[],
  pinnedPaths: string[],
  limit = EXPLORE_NAV_LIMIT,
): SessionCatalogEntry[] {
  const uniqueCatalog = dedupeCatalogEntriesById(catalogEntries);
  const catalogByPath = new Map(uniqueCatalog.map((entry) => [entry.path, entry]));
  const pinnedSet = new Set(pinnedPaths);

  const pinned = pinnedPaths
    .map((path) => catalogByPath.get(path))
    .filter((entry): entry is SessionCatalogEntry => Boolean(entry));

  const seenPaths = new Set(pinned.map((entry) => entry.path));
  const rest = sortCatalogByObserved(uniqueCatalog).filter(
    (entry) => !pinnedSet.has(entry.path) && !seenPaths.has(entry.path),
  );

  return [...pinned, ...rest].slice(0, limit);
}

export function exploreSessionNavIds(
  catalogEntries: SessionCatalogEntry[],
  pinnedPaths: string[],
): string[] {
  return exploreSessionNavEntries(catalogEntries, pinnedPaths).map((entry) => entry.id);
}

export function adjacentSessionId(
  ids: string[],
  currentId: string,
  direction: 1 | -1,
): string | null {
  if (!ids.length) return null;
  const index = ids.indexOf(currentId);
  const start = index >= 0 ? index : direction === 1 ? -1 : 0;
  const nextIndex = start + direction;
  if (nextIndex < 0 || nextIndex >= ids.length) return null;
  return ids[nextIndex] ?? null;
}

export function scrollExploreSessionIntoView(sessionId: string): void {
  document
    .getElementById(`explore-session-${sessionId}`)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
