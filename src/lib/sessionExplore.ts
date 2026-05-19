import type { SessionAnalysis } from "@/lib/sessionAnalysis";

/** Sessions you were in recently — best starting points in Explore. */
export function recentFamiliarSessions(
  sessions: SessionAnalysis[],
  limit = 6,
): SessionAnalysis[] {
  return [...sessions]
    .filter((session) => session.familiarity)
    .sort((a, b) => (a.familiarity!.rank ?? 99) - (b.familiarity!.rank ?? 99))
    .slice(0, limit);
}

export function sortSessionsByObserved(sessions: SessionAnalysis[]): SessionAnalysis[] {
  return [...sessions].sort(
    (a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt),
  );
}

export function pickDefaultExploreSessionId(sessions: SessionAnalysis[]): string {
  const familiar = recentFamiliarSessions(sessions, 1);
  if (familiar[0]) return familiar[0].id;

  const ranked = sessions
    .filter((session) => session.goodContext)
    .sort((a, b) => (a.goodContext?.rank ?? 99) - (b.goodContext?.rank ?? 99));
  if (ranked[0]) return ranked[0].id;

  return sortSessionsByObserved(sessions)[0]?.id ?? "";
}

export function formatObservedRelative(observedAt: string, now = Date.now()): string {
  const ms = Date.parse(observedAt);
  if (Number.isNaN(ms)) return "unknown";
  const delta = Math.max(0, now - ms);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
