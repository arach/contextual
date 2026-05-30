"use client";

import { ChevronRight, CornerLeftUp } from "lucide-react";
import { useMemo } from "react";

import type { ContextTreeNode } from "@/lib/contextTree";
import { formatAnalysisTokens } from "@/lib/sessionAnalysis";

export interface ContextBreadcrumbsProps {
  tree: ContextTreeNode;
  selectedNodeId: string;
  onSelect: (id: string) => void;
}

/**
 * Clickable path navigation for the current selection. Mirrors the file-path
 * shown in the editor header but every segment is a button — click to jump up,
 * arrow-up-button climbs one level. Reads from the same tree the sidebar uses.
 */
export function ContextBreadcrumbs({ tree, selectedNodeId, onSelect }: ContextBreadcrumbsProps) {
  const segments = useMemo(() => collectAncestors(tree, selectedNodeId), [tree, selectedNodeId]);
  if (segments.length === 0) return null;

  const last = segments[segments.length - 1];
  const parent = segments.length > 1 ? segments[segments.length - 2] : null;

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-[var(--hg-line)] bg-[var(--hg-surface)] px-3 py-1 font-mono text-[10px] text-[var(--hg-muted)]">
      <div className="flex min-w-0 flex-1 items-center gap-1 truncate">
        {segments.map((node, i) => {
          const isLast = i === segments.length - 1;
          if (isLast) {
            return (
              <span key={node.id} className="truncate text-[var(--hg-ink)]">
                {node.name}
              </span>
            );
          }
          return (
            <span key={node.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(node.id)}
                className="truncate text-[var(--hg-muted)] transition-colors hover:text-[var(--hg-ink)]"
              >
                {node.name}
              </button>
              <ChevronRight size={10} className="shrink-0 text-[var(--hg-line)]" />
            </span>
          );
        })}
      </div>
      {last.tokens != null && (
        <span className="shrink-0 tabular-nums">{formatAnalysisTokens(last.tokens)} tok</span>
      )}
      {parent && (
        <button
          type="button"
          onClick={() => onSelect(parent.id)}
          className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-[2px] border border-[var(--hg-line)] px-1.5 py-[1px] uppercase tracking-wider text-[9px] text-[var(--hg-muted)] transition-colors hover:border-[var(--hg-accent)]/40 hover:text-[var(--hg-ink)]"
          title="Jump up one level"
        >
          <CornerLeftUp size={10} />
          up
        </button>
      )}
    </div>
  );
}

function collectAncestors(root: ContextTreeNode, targetId: string): ContextTreeNode[] {
  const trail: ContextTreeNode[] = [];
  const walk = (node: ContextTreeNode): boolean => {
    trail.push(node);
    if (node.id === targetId) return true;
    for (const child of node.children ?? []) {
      if (walk(child)) return true;
    }
    trail.pop();
    return false;
  };
  walk(root);
  return trail;
}
