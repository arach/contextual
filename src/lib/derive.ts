// Pure derivations from a Thread — used by both the rack (gauges, eviction)
// and the composer (launch bar, manifest, over-budget signaling).

import type { Thread, SoftItem } from "@/types";
import { TOTAL_BUDGET } from "@/types";
import { MODULE_LIBRARY } from "@/data/modules";
import { sumTokens } from "@/lib/tokens";

export interface DecayedSoftItem {
  item: SoftItem;
  evicted: boolean;
}

/**
 * Apply the `softKeep` window to a thread's soft items, oldest-first.
 * Summaries are always kept (they're how older history survives compaction);
 * non-summary items beyond `softKeep` from the end are flagged as evicted.
 */
export function decaySoft(thread: Thread): DecayedSoftItem[] {
  const reversed = [...thread.soft].reverse();
  const out: DecayedSoftItem[] = [];
  let kept = 0;
  for (const item of reversed) {
    if (item.kind === "summary") {
      out.push({ item, evicted: false });
      continue;
    }
    if (kept < thread.softKeep) {
      out.push({ item, evicted: false });
      kept += 1;
    } else {
      out.push({ item, evicted: true });
    }
  }
  return out.reverse();
}

/** Resolve Fixed module ids against the library, skipping any unknown ids. */
export function resolveFixed(thread: Thread) {
  return thread.fixed.map((id) => MODULE_LIBRARY[id]).filter(Boolean);
}

/** Compose the manifest — exactly what would ship in the next call. */
export function buildManifest(thread: Thread) {
  const fixed = resolveFixed(thread);
  const decayed = decaySoft(thread);
  const liveSoft = decayed.filter((d) => !d.evicted).map((d) => d.item);
  // Summaries always survive; dedup against the live window so we don't double-count.
  const summaries = thread.soft.filter((s): s is Extract<SoftItem, { kind: "summary" }> => s.kind === "summary");
  const merged = Array.from(
    new Map<string, SoftItem>([...summaries, ...liveSoft].map((s) => [s.id, s])).values(),
  );
  const fixedTokens = sumTokens(fixed);
  const softTokens = sumTokens(merged) + (thread.task?.tokens ?? 0);
  const evicted = decayed.filter((d) => d.evicted).map((d) => d.item);
  return {
    fixed,
    softLive: merged,
    evicted,
    fixedTokens,
    softTokens,
    total: fixedTokens + softTokens,
    budget: TOTAL_BUDGET,
  };
}
