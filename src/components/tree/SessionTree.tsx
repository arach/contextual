// /tree — visualizes pi's session graph. Each session is a node in a forest
// (parents linked via parentSession). Nodes show message counts, cost, and
// which Contextual branch they're bound to.
//
// Rendered as a fixed overlay above the chrome. ESC or backdrop click closes.

import { useEffect, useMemo, useState } from "react";
import type { SessionSummary, TreeResponse } from "@/lib/backends/client";
import { fetchTree } from "@/lib/backends/client";

interface SessionTreeProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TreeNode {
  session: SessionSummary;
  children: TreeNode[];
  /** "{threadId}::{branchId}" bindings that point here, if any. */
  bindings: string[];
}

function buildForest(data: TreeResponse): TreeNode[] {
  const byPath = new Map<string, TreeNode>();
  for (const s of data.sessions) {
    byPath.set(s.path, { session: s, children: [], bindings: [] });
  }
  for (const [k, slot] of Object.entries(data.branches)) {
    if (!slot.sessionPath) continue;
    const node = byPath.get(slot.sessionPath);
    if (node) node.bindings.push(k);
  }
  const roots: TreeNode[] = [];
  for (const node of byPath.values()) {
    const parent = node.session.parentSession;
    if (parent && byPath.has(parent)) {
      byPath.get(parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Stable ordering: roots and children by lastTimestamp.
  const cmp = (a: TreeNode, b: TreeNode) =>
    a.session.lastTimestamp.localeCompare(b.session.lastTimestamp);
  roots.sort(cmp);
  for (const n of byPath.values()) n.children.sort(cmp);
  return roots;
}

export function SessionTree({ isOpen, onClose }: SessionTreeProps) {
  const [data, setData] = useState<TreeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setErr(null);
    fetchTree()
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const forest = useMemo(() => (data ? buildForest(data) : []), [data]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-10"
      onClick={onClose}
    >
      <div
        className="bg-[var(--hg-bg)] border border-[var(--hg-line)] rounded-[2px] w-full max-w-[860px] max-h-full overflow-hidden flex flex-col shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-5 py-3 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)]">
          <span className="hg-mono text-[11px] tracking-wider uppercase text-[var(--hg-accent)]">
            /tree
          </span>
          <span className="hg-mono text-[10.5px] tracking-wider uppercase text-[var(--hg-muted)]">
            pi session forest · {data?.sessions.length ?? 0} sessions
          </span>
          <button className="hg-btn ml-auto" onClick={onClose}>
            close · esc
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4 hg-mono text-[12px]">
          {loading && <div className="text-[var(--hg-muted)] italic">loading…</div>}
          {err && <div className="text-[var(--hg-warn)]">error · {err}</div>}
          {!loading && !err && forest.length === 0 && (
            <div className="text-[var(--hg-muted)] italic">
              no sessions yet — dispatch a message to create one.
            </div>
          )}
          {forest.map((root) => (
            <TreeNodeView key={root.session.path} node={root} depth={0} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TreeNodeView({ node, depth }: { node: TreeNode; depth: number }) {
  const s = node.session;
  return (
    <div>
      <div
        className="flex items-baseline gap-3 py-1.5 border-b border-dashed border-[var(--hg-hairline)]"
        style={{ paddingLeft: depth * 24 }}
      >
        {depth > 0 && (
          <span className="text-[var(--hg-hairline)] -ml-3 select-none">└─</span>
        )}
        <span className="text-[var(--hg-accent)] tracking-wider">{s.id.slice(0, 8)}</span>
        <span className="text-[var(--hg-ink)] flex-1 min-w-0 truncate not-italic">
          {s.firstUserText || "(no user message yet)"}
        </span>
        {node.bindings.map((b) => (
          <span key={b} className="hg-pill accent text-[9.5px]">
            {b.split("::").join("/")}
          </span>
        ))}
        <span className="text-[var(--hg-muted)]">
          {s.userCount}u/{s.assistantCount}a
        </span>
        <span className="text-[var(--hg-muted)]">{(s.totalTokens / 1000).toFixed(1)}k</span>
        <span className="text-[var(--hg-muted)]">${s.totalCost.toFixed(4)}</span>
      </div>
      {node.children.map((c) => (
        <TreeNodeView key={c.session.path} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}
