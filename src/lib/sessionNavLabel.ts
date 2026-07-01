import type { SessionAnalysis } from "@/lib/sessionAnalysis";
import { formatObservedRelative } from "@/lib/sessionExplore";
import { displaySessionTitle } from "@/lib/sessionLabel";

const GENERIC_SUMMARY = /^discovered agent transcript on disk\.?$/i;

export function sessionIdSuffix(id: string): string {
  const hex = id.replace(/-/g, "").toLowerCase();
  return hex.slice(-4) || id.slice(-4).toLowerCase();
}

export function sessionNavMeta(session: Pick<SessionAnalysis, "project" | "id" | "observedAt">): string {
  return `${session.project} · …${sessionIdSuffix(session.id)} · ${formatObservedRelative(session.observedAt)}`;
}

function clipLine(text: string, max = 92): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

/** One-line subtitle for sidebar rows — prefer analysis summary over broker-ish titles. */
export function sessionNavDetail(session: Pick<SessionAnalysis, "title" | "summary">): string {
  const summary = session.summary?.trim() ?? "";
  const title = displaySessionTitle(session.title);
  if (summary && !GENERIC_SUMMARY.test(summary)) {
    return clipLine(summary);
  }
  return clipLine(title);
}
