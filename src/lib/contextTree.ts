import { bucketMeta, formatAnalysisTokens, type ContextAtom, type ContextBlock, type ContextBucketId, type ContextSlice, type SessionAnalysis, type ThresholdSnapshot } from "@/lib/sessionAnalysis";
import { atomsInWindowOrder, splitWindowSections } from "@/lib/sessionWindow";

export type ContextTreeNodeKind = "folder" | "overview" | "atom" | "slice" | "block";

export interface ContextTreeNode {
  id: string;
  name: string;
  /** Breadcrumb path segments, e.g. ["context", "window", "pinned"] */
  path: string[];
  kind: ContextTreeNodeKind;
  children?: ContextTreeNode[];
  atomId?: string;
  blockId?: string;
  sliceId?: string;
  bucket?: ContextBucketId;
  tokens?: number;
  detail?: string;
}

function slug(text: string, max = 28): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max) || "item";
}

function atomFileName(atom: ContextAtom, index: number): string {
  return `${String(index).padStart(3, "0")}-${slug(atom.label)}.${atom.bucket}`;
}

function atomLeaf(_session: SessionAnalysis, atom: ContextAtom, index: number, pathPrefix: string[]): ContextTreeNode {
  return {
    id: `atom:${atom.id}`,
    name: atomFileName(atom, index),
    path: [...pathPrefix, atomFileName(atom, index)],
    kind: "atom",
    atomId: atom.id,
    bucket: atom.bucket,
    tokens: atom.tokens,
    detail: atom.summary,
  };
}

function sliceFolder(
  session: SessionAnalysis,
  slice: ContextSlice,
  atomsById: Map<string, ContextAtom>,
  snapshotAtomIds: Set<string>,
  pathPrefix: string[],
): ContextTreeNode {
  const sliceName = `${slug(slice.lifecycle)}-${slug(slice.artifactType)}.slice`;
  const children = slice.atomRefs
    .filter((id) => snapshotAtomIds.has(id))
    .map((id) => atomsById.get(id))
    .filter((atom): atom is ContextAtom => Boolean(atom))
    .sort((a, b) => (a.messageIndex ?? 0) - (b.messageIndex ?? 0))
    .map((atom, index) => atomLeaf(session, atom, index + 1, [...pathPrefix, sliceName]));

  return {
    id: `slice:${slice.id}`,
    name: sliceName,
    path: [...pathPrefix, sliceName],
    kind: "slice",
    sliceId: slice.id,
    bucket: slice.bucket,
    tokens: slice.tokens,
    detail: slice.summary,
    children,
  };
}

function blockLeaf(block: ContextBlock, pathPrefix: string[]): ContextTreeNode {
  const name = `${slug(block.kind)}.block`;
  return {
    id: `block:${block.id}`,
    name,
    path: [...pathPrefix, name],
    kind: "block",
    blockId: block.id,
    bucket: block.bucket,
    tokens: block.tokens,
    detail: block.summary,
  };
}

export function buildContextTree(session: SessionAnalysis, snapshot: ThresholdSnapshot): ContextTreeNode {
  const snapshotAtomIds = new Set(snapshot.chunkRefs);
  const atomsById = new Map(session.atoms.map((atom) => [atom.id, atom]));
  const ordered = atomsInWindowOrder(session, snapshot);
  const { pinned, tail } = splitWindowSections(ordered);

  const windowPinned = pinned.map((atom, index) =>
    atomLeaf(session, atom, index + 1, ["context", "window", "pinned"]),
  );
  const windowTail = tail.map((atom, index) =>
    atomLeaf(session, atom, index + 1, ["context", "window", "tail"]),
  );
  const windowChronological = ordered.map((atom, index) =>
    atomLeaf(session, atom, index + 1, ["context", "window", "chronological"]),
  );

  const bucketFolders: ContextTreeNode[] = [];
  const bucketsInSnapshot = new Set<ContextBucketId>();
  for (const atom of ordered) bucketsInSnapshot.add(atom.bucket);

  for (const bucket of [...bucketsInSnapshot].sort()) {
    const meta = bucketMeta(bucket);
    const bucketPath = ["context", "buckets", bucket];
    const slices = session.slices
      .filter(
        (slice) =>
          slice.bucket === bucket &&
          slice.atomRefs.some((atomRef) => snapshotAtomIds.has(atomRef)),
      )
      .sort((a, b) => b.tokens - a.tokens);

    bucketFolders.push({
      id: `bucket:${bucket}`,
      name: bucket,
      path: bucketPath,
      kind: "folder",
      bucket,
      detail: meta.label,
      children: slices.map((slice) =>
        sliceFolder(session, slice, atomsById, snapshotAtomIds, bucketPath),
      ),
    });
  }

  const recipeBlocks = session.recipeDraft.blocks
    .filter((block) => block.quality !== "discard")
    .slice(0, 24)
    .map((block) => blockLeaf(block, ["context", "recipe"]));

  return {
    id: "context:root",
    name: "context",
    path: ["context"],
    kind: "folder",
    children: [
      {
        id: "context:overview",
        name: "session.md",
        path: ["context", "session.md"],
        kind: "overview",
        detail: session.summary,
      },
      {
        id: "context:window",
        name: "window",
        path: ["context", "window"],
        kind: "folder",
        detail: `${formatAnalysisTokens(snapshot.coveredTokens)} at threshold`,
        children: [
          {
            id: "context:window:pinned",
            name: "pinned",
            path: ["context", "window", "pinned"],
            kind: "folder",
            detail: formatAnalysisTokens(snapshot.pinnedTokens),
            children: windowPinned,
          },
          {
            id: "context:window:tail",
            name: "tail",
            path: ["context", "window", "tail"],
            kind: "folder",
            detail: formatAnalysisTokens(snapshot.tailTokens),
            children: windowTail,
          },
          {
            id: "context:window:chronological",
            name: "chronological",
            path: ["context", "window", "chronological"],
            kind: "folder",
            detail: `${ordered.length} atoms in message order`,
            children: windowChronological,
          },
        ],
      },
      {
        id: "context:buckets",
        name: "buckets",
        path: ["context", "buckets"],
        kind: "folder",
        children: bucketFolders,
      },
      {
        id: "context:recipe",
        name: "recipe",
        path: ["context", "recipe"],
        kind: "folder",
        detail: `${session.recipeDraft.blocks.length} candidate blocks`,
        children: recipeBlocks,
      },
    ],
  };
}

export function flattenContextTree(root: ContextTreeNode): ContextTreeNode[] {
  const out: ContextTreeNode[] = [];
  const walk = (node: ContextTreeNode) => {
    out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return out;
}

export function findContextNode(root: ContextTreeNode, id: string): ContextTreeNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findContextNode(child, id);
    if (found) return found;
  }
  return null;
}

export function defaultContextNodeId(root: ContextTreeNode): string {
  const flat = flattenContextTree(root);
  const firstAtom = flat.find((node) => node.kind === "atom");
  if (firstAtom) return firstAtom.id;
  return flat.find((node) => node.kind === "overview")?.id ?? root.id;
}

export function filterContextTree(root: ContextTreeNode, query: string): ContextTreeNode | null {
  const q = query.trim().toLowerCase();
  if (!q) return root;

  const matches = (node: ContextTreeNode) =>
    node.name.toLowerCase().includes(q) ||
    node.detail?.toLowerCase().includes(q) ||
    node.path.some((segment) => segment.toLowerCase().includes(q));

  const walk = (node: ContextTreeNode): ContextTreeNode | null => {
    const childMatches = (node.children ?? [])
      .map((child) => walk(child))
      .filter((child): child is ContextTreeNode => Boolean(child));

    if (matches(node) || childMatches.length) {
      return { ...node, children: childMatches.length ? childMatches : node.children };
    }
    return null;
  };

  return walk(root);
}

export function collectMatchContextPaths(root: ContextTreeNode, query: string): Set<string> {
  const q = query.trim().toLowerCase();
  if (!q) return collectExpandedContextPaths(root);

  const paths = new Set<string>();
  const walk = (node: ContextTreeNode, ancestors: string[]) => {
    const path = [...ancestors, node.id];
    const hit =
      node.name.toLowerCase().includes(q) ||
      node.detail?.toLowerCase().includes(q) ||
      node.path.some((segment) => segment.toLowerCase().includes(q));

    for (const child of node.children ?? []) walk(child, path);

    if (hit) {
      for (const id of path) paths.add(id);
    }
  };
  walk(root, []);
  return paths;
}

export function collectExpandedContextPaths(root: ContextTreeNode): Set<string> {
  return new Set([
    "context:root",
    "context:window",
    "context:window:pinned",
    "context:window:tail",
    "context:window:chronological",
    "context:buckets",
    "context:recipe",
    ...flattenContextTree(root)
      .filter((node) => node.kind === "folder" && node.id.startsWith("bucket:"))
      .map((node) => node.id),
  ]);
}
