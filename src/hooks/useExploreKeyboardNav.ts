import { useEffect, useRef } from "react";

import type { ExploreAnalysisState } from "@/components/analysis/SessionAnalysis";
import {
  adjacentSessionId,
  exploreSessionNavIds,
  scrollExploreSessionIntoView,
} from "@/lib/exploreNavOrder";
import { focusExplorePanel } from "@/lib/explorePanels";
import { isEditableKeyboardTarget } from "@/lib/keyboardTarget";
import { ANALYSIS_THRESHOLDS, type ContextBucketId } from "@/lib/sessionAnalysis";

function cycleThreshold(current: number, direction: 1 | -1): number {
  const list: number[] = [...ANALYSIS_THRESHOLDS];
  const index = list.indexOf(current);
  const start = index >= 0 ? index : 0;
  const next = start + direction;
  if (next < 0) return list[0]!;
  if (next >= list.length) return list[list.length - 1]!;
  return list[next]!;
}

function cycleBucket(
  allocations: { bucket: ContextBucketId }[],
  current: ContextBucketId,
  direction: 1 | -1,
): ContextBucketId {
  if (!allocations.length) return current;
  const buckets = allocations.map((item) => item.bucket);
  const index = buckets.indexOf(current);
  const start = index >= 0 ? index : direction === 1 ? -1 : buckets.length;
  const next = start + direction;
  if (next < 0 || next >= buckets.length) return current;
  return buckets[next]!;
}

export function useExploreKeyboardNav(state: ExploreAnalysisState, enabled: boolean): void {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const s = stateRef.current;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableKeyboardTarget(event.target)) return;

      const key = event.key;

      if (key === "j" || key === "k") {
        const ids = exploreSessionNavIds(s.catalogEntries, s.pinnedPaths);
        const direction = key === "j" ? 1 : -1;
        const nextId = adjacentSessionId(ids, s.activeId, direction);
        if (!nextId) return;
        event.preventDefault();
        s.setActiveId(nextId);
        scrollExploreSessionIntoView(nextId);
        return;
      }

      if (key === "[") {
        event.preventDefault();
        s.setThreshold(cycleThreshold(s.threshold, -1));
        return;
      }

      if (key === "]") {
        event.preventDefault();
        s.setThreshold(cycleThreshold(s.threshold, 1));
        return;
      }

      if (key === "{" || key === "}") {
        const allocations = s.activeSnapshot?.allocations;
        if (!allocations?.length) return;
        event.preventDefault();
        s.setSelectedBucket(
          cycleBucket(allocations, s.selectedBucket, key === "}" ? 1 : -1),
        );
        return;
      }

      if (key === "1" || key === "2" || key === "3") {
        event.preventDefault();
        focusExplorePanel(key === "1" ? "sessions" : key === "2" ? "tree" : "inspector");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
