import type { ContextAtom, SessionAnalysis, ThresholdSnapshot } from "@/lib/sessionAnalysis";

/** Atoms included at this threshold, in simulated window order (pinned block, then recent tail). */
export function atomsInWindowOrder(
  session: SessionAnalysis,
  snapshot: ThresholdSnapshot,
): ContextAtom[] {
  const byId = new Map(session.atoms.map((atom) => [atom.id, atom]));
  return snapshot.chunkRefs
    .map((id) => byId.get(id))
    .filter((atom): atom is ContextAtom => Boolean(atom));
}

export function splitWindowSections(ordered: ContextAtom[]): {
  pinned: ContextAtom[];
  tail: ContextAtom[];
} {
  const pinned: ContextAtom[] = [];
  const tail: ContextAtom[] = [];
  let inTail = false;
  for (const atom of ordered) {
    if (!inTail && atom.pinned) pinned.push(atom);
    else {
      inTail = true;
      tail.push(atom);
    }
  }
  return { pinned, tail };
}
