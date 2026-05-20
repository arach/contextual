import type { ContextTreeNode } from "@/lib/contextTree";

export interface ContextTreeNavIndex {
  visible: ContextTreeNode[];
  parentById: Map<string, string | null>;
}

export function buildContextTreeNavIndex(
  roots: ContextTreeNode[],
  expanded: Set<string>,
): ContextTreeNavIndex {
  const visible: ContextTreeNode[] = [];
  const parentById = new Map<string, string | null>();

  const walk = (nodes: ContextTreeNode[], parentId: string | null) => {
    for (const node of nodes) {
      visible.push(node);
      parentById.set(node.id, parentId);
      const hasChildren = Boolean(node.children?.length);
      if (hasChildren && expanded.has(node.id)) {
        walk(node.children!, node.id);
      }
    }
  };

  walk(roots, null);
  return { visible, parentById };
}

export function adjacentVisibleNodeId(
  index: ContextTreeNavIndex,
  currentId: string,
  direction: 1 | -1,
): string | null {
  const { visible } = index;
  if (!visible.length) return null;
  const pos = visible.findIndex((node) => node.id === currentId);
  const start = pos >= 0 ? pos : direction === 1 ? -1 : visible.length;
  const next = start + direction;
  if (next < 0 || next >= visible.length) return null;
  return visible[next]!.id;
}

export function scrollExploreTreeNodeIntoView(nodeId: string): void {
  const el = document.querySelector(`[data-explore-tree-node-id="${nodeId}"]`);
  el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
