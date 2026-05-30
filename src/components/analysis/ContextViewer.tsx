"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  FolderClosed,
  FolderOpen,
  GitBranch,
  Search,
  X,
} from "lucide-react";
import { CodeEditor, type DocumentLanguage } from "hudsonkit/controls";
import { usePersistentState } from "hudsonkit";

import { ContextBudgetStrip } from "@/components/analysis/ContextBudgetStrip";
import { ContextBreadcrumbs } from "@/components/analysis/ContextBreadcrumbs";
import { ContextAsOfPanel } from "@/components/analysis/ContextAsOfPanel";
import { CurationRollup } from "@/components/analysis/CurationRollup";
import { CurationPill, CurateModeToggle } from "@/components/analysis/CurationPill";
import { useCuration, type CurationApi } from "@/lib/contextCuration";

import {
  bucketMeta,
  formatAnalysisTokens,
  type ContextAtom,
  type ContextBlock,
  type SessionAnalysis,
  type ContextSlice,
  type ThresholdSnapshot,
} from "@/lib/sessionAnalysis";
import {
  buildContextTreeForMode,
  collectExpandedContextPaths,
  collectMatchContextPaths,
  defaultContextNodeId,
  filterContextTree,
  findContextNode,
  flattenContextTree,
  type ContextTreeNode,
  type ContextViewMode,
} from "@/lib/contextTree";
import {
  adjacentVisibleNodeId,
  buildContextTreeNavIndex,
  scrollExploreTreeNodeIntoView,
} from "@/lib/contextTreeNav";
import { isEditableKeyboardTarget } from "@/lib/keyboardTarget";
import { EXPLORE_PANEL_IDS } from "@/lib/explorePanels";
import { displaySessionTitle } from "@/lib/sessionLabel";
import { sessionIdSuffix, sessionNavMeta } from "@/lib/sessionNavLabel";
import { formatObservedRelative } from "@/lib/sessionExplore";
import type {
  AtRestLine,
  ExploreContextMode,
  ManifestPart,
  ManifestTruth,
  TurnReadyManifest,
  TurnRecord,
} from "@/lib/harnessContract";
import {
  AT_REST_OVERVIEW_NODE_ID,
  TURN_READY_OVERVIEW_NODE_ID,
  buildAtRestTree,
  buildTurnReadyTree,
  turnLabel,
  useHarnessAtRest,
  useHarnessManifest,
  useHarnessSessionKey,
  useHarnessTurns,
} from "@/lib/harnessExplore";

const CONTEXT_SIDEBAR_DEFAULT = 260;
const CONTEXT_SIDEBAR_MIN = 200;
const CONTEXT_SIDEBAR_MAX = 480;

interface ContextViewerProps {
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  blockDrafts: Record<string, string>;
  contextNodeDrafts: Record<string, string>;
  onBlockDraftChange: (blockId: string, body: string) => void;
  onContextNodeDraftChange: (nodeId: string, body: string) => void;
  onOpenTree?: () => void;
}

export function ContextViewer({
  session,
  snapshot,
  selectedNodeId,
  onSelectNode,
  blockDrafts,
  contextNodeDrafts,
  onBlockDraftChange,
  onContextNodeDraftChange,
  onOpenTree,
}: ContextViewerProps) {
  const [sidebarWidth, setSidebarWidth] = usePersistentState(
    "contextual.exploreContextWidth",
    CONTEXT_SIDEBAR_DEFAULT,
  );
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onSidebarResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startW: sidebarWidth };
      const move = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        const next = Math.max(
          CONTEXT_SIDEBAR_MIN,
          Math.min(CONTEXT_SIDEBAR_MAX, dragRef.current.startW + delta),
        );
        setSidebarWidth(next);
      };
      const up = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    },
    [sidebarWidth, setSidebarWidth],
  );

  const [mode, setMode] = usePersistentState<ExploreContextMode>(
    "contextual.exploreContextMode",
    "contextual",
  );

  const harnessKey = useHarnessSessionKey(session.path);
  const atRest = useHarnessAtRest(mode === "at-rest" ? harnessKey.key : null);
  const turns = useHarnessTurns(mode === "turn-ready" ? harnessKey.key : null);
  const [selectedTurn, setSelectedTurn] = useState<"latest" | string>("latest");
  const manifest = useHarnessManifest(
    mode === "turn-ready" ? harnessKey.key : null,
    selectedTurn,
  );

  const contextualTree = useMemo(
    () => buildContextTreeForMode(session, snapshot, "contextual"),
    [session, snapshot],
  );

  // Curation only meaningfully applies to the contextual tree (at-rest and
  // turn-ready are logged data, read-only). The hook lives at the top level so
  // its rollup can flow into the budget strip and the right rail.
  const curate = useCuration({ sessionId: session.id, tree: contextualTree });
  const atRestTreeData = useMemo(
    () => buildAtRestTree(atRest.lines, atRest.totalLines),
    [atRest.lines, atRest.totalLines],
  );
  const turnReadyTreeData = useMemo(
    () => buildTurnReadyTree(manifest.manifest),
    [manifest.manifest],
  );

  const tree =
    mode === "contextual"
      ? contextualTree
      : mode === "at-rest"
        ? atRestTreeData.tree
        : turnReadyTreeData.tree;

  const [atRestSelectedId, setAtRestSelectedId] = useState<string>(AT_REST_OVERVIEW_NODE_ID);
  const [turnReadySelectedId, setTurnReadySelectedId] = useState<string>(
    TURN_READY_OVERVIEW_NODE_ID,
  );

  const currentSelectedId =
    mode === "contextual"
      ? selectedNodeId
      : mode === "at-rest"
        ? atRestSelectedId
        : turnReadySelectedId;

  const setCurrentSelectedId = useCallback(
    (id: string) => {
      if (mode === "contextual") onSelectNode(id);
      else if (mode === "at-rest") setAtRestSelectedId(id);
      else setTurnReadySelectedId(id);
    },
    [mode, onSelectNode],
  );

  const defaultExpandedForMode = useCallback(
    (root: ContextTreeNode): Set<string> => {
      if (mode === "contextual") return collectExpandedContextPaths(root, "contextual");
      if (mode === "at-rest") return new Set(["at-rest:root", "at-rest:lines"]);
      return new Set(["turn-ready:root", "turn-ready:parts"]);
    },
    [mode],
  );

  const [treeQuery, setTreeQuery] = useState("");
  const filteredTree = useMemo(
    () => (treeQuery.trim() ? filterContextTree(tree, treeQuery) : tree),
    [tree, treeQuery],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpandedForMode(tree));

  useEffect(() => {
    setExpanded(
      treeQuery.trim()
        ? collectMatchContextPaths(tree, treeQuery)
        : defaultExpandedForMode(tree),
    );
  }, [session.id, snapshot.threshold, tree, treeQuery, defaultExpandedForMode]);

  const switchMode = useCallback(
    (nextMode: ExploreContextMode) => {
      if (nextMode === mode) return;
      setMode(nextMode);
    },
    [mode, setMode],
  );

  useEffect(() => {
    if (!filteredTree) return;
    if (!findContextNode(filteredTree, currentSelectedId)) {
      setCurrentSelectedId(defaultContextNodeId(filteredTree));
    }
  }, [filteredTree, currentSelectedId, setCurrentSelectedId]);

  const selected = filteredTree ? findContextNode(filteredTree, currentSelectedId) : null;
  const visibleTree = filteredTree ?? tree;
  const matchCount = useMemo(() => {
    const q = treeQuery.trim().toLowerCase();
    if (!q) return 0;
    return flattenContextTree(tree).filter(
      (node) =>
        node.kind !== "folder" &&
        (node.name.toLowerCase().includes(q) ||
          node.detail?.toLowerCase().includes(q) ||
          node.path.some((segment) => segment.toLowerCase().includes(q))),
    ).length;
  }, [tree, treeQuery]);

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onTreeKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isEditableKeyboardTarget(event.target)) return;
    if (!visibleTree) return;

    const roots = visibleTree.children ?? [];
    const navIndex = buildContextTreeNavIndex(roots, expanded);
    const currentId = currentSelectedId;

    const moveTo = (id: string | null) => {
      if (!id) return;
      setCurrentSelectedId(id);
      scrollExploreTreeNodeIntoView(id);
    };

    if (event.key === "ArrowDown") {
      const nextId = adjacentVisibleNodeId(navIndex, currentId, 1);
      if (!nextId) return;
      event.preventDefault();
      moveTo(nextId);
      return;
    }

    if (event.key === "ArrowUp") {
      const nextId = adjacentVisibleNodeId(navIndex, currentId, -1);
      if (!nextId) return;
      event.preventDefault();
      moveTo(nextId);
      return;
    }

    const current = findContextNode(visibleTree, currentId);
    const hasChildren = Boolean(current?.children?.length);
    const isExpanded = expanded.has(currentId);

    if (event.key === "ArrowRight") {
      if (!current || !hasChildren) return;
      event.preventDefault();
      if (!isExpanded) {
        toggleExpanded(currentId);
        return;
      }
      moveTo(current.children![0]!.id);
      return;
    }

    if (event.key === "ArrowLeft") {
      if (!current) return;
      event.preventDefault();
      if (hasChildren && isExpanded) {
        toggleExpanded(currentId);
        return;
      }
      moveTo(navIndex.parentById.get(currentId) ?? null);
    }
  };

  useEffect(() => {
    scrollExploreTreeNodeIntoView(currentSelectedId);
  }, [currentSelectedId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-3 py-1.5">
        <span className="hg-mono text-[10px] text-[var(--hg-muted)] truncate">
          {sessionNavMeta(session)}
          {mode === "contextual"
            ? ` · ${formatAnalysisTokens(snapshot.threshold)} window`
            : mode === "at-rest"
              ? ` · ${atRest.totalLines || "…"} jsonl lines`
              : ` · ${manifest.manifest?.parts.length ?? "…"} manifest parts`}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {mode === "contextual" && <CurateModeToggle curate={curate} />}
          {onOpenTree && (
            <button
              type="button"
              onClick={onOpenTree}
              className="inline-flex items-center gap-1 rounded-[2px] border border-[var(--hg-line)] px-2 py-1 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)] hover:text-[var(--hg-ink)]"
              title="Open pi session fork tree (⌘T)"
            >
              <GitBranch size={12} />
              fork tree
            </button>
          )}
          <div
            className="inline-flex rounded-[2px] border border-[var(--hg-line)] p-0.5"
            role="group"
            aria-label="Explore context mode"
          >
            {(["at-rest", "turn-ready", "contextual"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => switchMode(opt)}
                aria-pressed={mode === opt}
                className={
                  "rounded-[1px] px-2 py-0.5 hg-mono text-[9px] uppercase tracking-wider transition-colors " +
                  (mode === opt
                    ? "bg-[var(--hg-accent-tint)] text-[var(--hg-ink)]"
                    : "text-[var(--hg-muted)] hover:text-[var(--hg-ink)]")
                }
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ContextBudgetStrip
        mode={mode}
        session={session}
        snapshot={snapshot}
        manifest={mode === "turn-ready" ? manifest.manifest : null}
        atRest={
          mode === "at-rest"
            ? { loadedLines: atRest.lines.length, totalLines: atRest.totalLines }
            : null
        }
        curatedTokens={
          mode === "contextual" && curate.enabled ? curate.curatedTokens : null
        }
      />

      {visibleTree && (
        <ContextBreadcrumbs
          tree={visibleTree}
          selectedNodeId={currentSelectedId}
          onSelect={setCurrentSelectedId}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="relative flex shrink-0" style={{ width: sidebarWidth }}>
          <aside
            id={EXPLORE_PANEL_IDS.tree}
            tabIndex={0}
            onKeyDown={onTreeKeyDown}
            className="flex h-full min-w-0 flex-col border-r border-[var(--hg-line)] bg-[var(--hg-surface)] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--hg-accent)]"
            aria-label="Context file tree"
          >
            <div className="min-h-0 flex-1 overflow-auto">
            <div className="border-b border-[var(--hg-line)] px-3 py-2">
            <div className="hg-section-label">context</div>
            <div className="mt-0.5 text-[10px] leading-snug text-[var(--hg-muted)]">
              {mode === "at-rest"
                ? "at-rest · native jsonl lines on disk"
                : mode === "turn-ready"
                  ? "turn-ready · ordered manifest as sent to the model"
                  : "contextual model · simulated window, buckets & slices"}
            </div>
            <label className="relative mt-2 block">
              <Search
                size={11}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--hg-muted)]"
              />
              <input
                type="search"
                value={treeQuery}
                onChange={(event) => setTreeQuery(event.target.value)}
                placeholder="Filter tree…"
                className="w-full rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] py-1 pl-6 pr-6 font-mono text-[10px] text-[var(--hg-ink)] placeholder:text-[var(--hg-muted)] focus:border-[var(--hg-accent)] focus:outline-none"
              />
              {treeQuery && (
                <button
                  type="button"
                  onClick={() => setTreeQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--hg-muted)] hover:text-[var(--hg-ink)]"
                  aria-label="Clear tree filter"
                >
                  <X size={11} />
                </button>
              )}
            </label>
            {treeQuery.trim() && (
              <div className="mt-1 font-mono text-[9px] text-[var(--hg-muted)]">
                {matchCount ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "no matches"}
              </div>
            )}
          </div>
          {mode === "contextual" && curate.enabled && <CurationRollup curate={curate} />}
          <div className="py-1">
            {(visibleTree.children ?? []).map((node) => (
              <ContextTreeBranch
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                selectedNodeId={currentSelectedId}
                treeQuery={treeQuery}
                onToggle={toggleExpanded}
                onSelect={setCurrentSelectedId}
                curate={mode === "contextual" ? curate : null}
              />
            ))}
          </div>
          {mode === "at-rest" && atRest.nextFromLine != null && (
            <div className="border-t border-[var(--hg-line)] px-3 py-2">
              <button
                type="button"
                onClick={atRest.loadMore}
                disabled={atRest.loadingMore}
                className="w-full rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] px-2 py-1 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)] hover:text-[var(--hg-ink)] disabled:opacity-50"
              >
                {atRest.loadingMore
                  ? "loading…"
                  : `load more · ${atRest.lines.length} / ${atRest.totalLines}`}
              </button>
            </div>
          )}
          </div>
          <ContextAsOfPanel
            mode={mode}
            session={session}
            snapshot={snapshot}
            manifest={mode === "turn-ready" ? manifest.manifest : null}
            atRest={
              mode === "at-rest"
                ? { lines: atRest.lines, totalLines: atRest.totalLines }
                : null
            }
            selectedNodeId={currentSelectedId}
          />
          </aside>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize context sidebar"
            onMouseDown={onSidebarResizeStart}
            className="absolute right-0 top-0 bottom-0 z-10 flex w-[7px] cursor-ew-resize items-center justify-center group"
          >
            <div className="absolute right-0 top-0 bottom-0 w-px bg-[var(--hg-line)] transition-colors group-hover:bg-[var(--hg-accent)]/40" />
            <div className="flex flex-col gap-[3px] opacity-0 transition-opacity group-hover:opacity-100">
              <div className="h-[3px] w-[3px] rounded-full bg-[var(--hg-muted)] group-hover:bg-[var(--hg-accent)]" />
              <div className="h-[3px] w-[3px] rounded-full bg-[var(--hg-muted)] group-hover:bg-[var(--hg-accent)]" />
              <div className="h-[3px] w-[3px] rounded-full bg-[var(--hg-muted)] group-hover:bg-[var(--hg-accent)]" />
            </div>
          </div>
        </div>

        {mode === "contextual" ? (
          <ContextEditorPane
            session={session}
            snapshot={snapshot}
            node={selected}
            viewMode="contextual"
            blockDrafts={blockDrafts}
            contextNodeDrafts={contextNodeDrafts}
            onBlockDraftChange={onBlockDraftChange}
            onContextNodeDraftChange={onContextNodeDraftChange}
          />
        ) : mode === "at-rest" ? (
          <AtRestEditorPane
            node={selected}
            harnessKeyStatus={harnessKey.status}
            harnessKey={harnessKey.key}
            harnessError={harnessKey.error ?? atRest.error}
            status={atRest.status}
            totalLines={atRest.totalLines}
            loadedLines={atRest.lines.length}
            line={selected ? atRestTreeData.linesByNodeId.get(selected.id) ?? null : null}
          />
        ) : (
          <TurnReadyEditorPane
            node={selected}
            harnessKeyStatus={harnessKey.status}
            harnessKey={harnessKey.key}
            harnessError={harnessKey.error ?? manifest.error ?? turns.error}
            status={manifest.status}
            manifest={manifest.manifest}
            turns={turns.turns}
            selectedTurn={selectedTurn}
            onSelectTurn={setSelectedTurn}
            part={selected ? turnReadyTreeData.partsByNodeId.get(selected.id) ?? null : null}
          />
        )}
      </div>
    </div>
  );
}

function ContextTreeBranch({
  node,
  depth,
  expanded,
  selectedNodeId,
  treeQuery,
  onToggle,
  onSelect,
  curate,
}: {
  node: ContextTreeNode;
  depth: number;
  expanded: Set<string>;
  selectedNodeId: string;
  treeQuery: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  curate: CurationApi | null;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isFolder = node.kind === "folder" || (hasChildren && node.kind !== "atom" && node.kind !== "block");

  const Icon =
    node.kind === "atom" || node.kind === "block" || node.kind === "overview"
      ? FileText
      : isExpanded
        ? FolderOpen
        : FolderClosed;

  const curationState = curate ? curate.stateAt(node.id) : "keep";
  const isCurateable =
    curate?.enabled &&
    (node.kind === "atom" || node.kind === "block" || node.kind === "slice");
  const isDropped = curationState === "drop";
  const isSummarized = curationState === "summarize";

  return (
    <>
      <button
        type="button"
        data-explore-tree-node-id={node.id}
        onClick={() => {
          if (isFolder && hasChildren) onToggle(node.id);
          onSelect(node.id);
        }}
        className={
          "flex w-full items-center gap-1 py-[3px] pr-2 text-left transition-colors " +
          (isSelected
            ? "bg-[var(--hg-accent-tint)] text-[var(--hg-ink)]"
            : "text-[var(--hg-ink-2)] hover:bg-[var(--hg-bg-tint)]")
        }
        style={{ paddingLeft: 8 + depth * 14, opacity: isDropped ? 0.55 : 1 }}
      >
        {hasChildren ? (
          <span
            className="inline-flex shrink-0 text-[var(--hg-muted)]"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="inline-block w-3 shrink-0" />
        )}
        <Icon size={13} className="shrink-0 text-[var(--hg-muted)]" />
        <span
          className={`min-w-0 flex-1 truncate font-mono text-[11px] leading-none ${
            isDropped ? "line-through text-[var(--hg-warn)]" : ""
          } ${isSummarized ? "italic" : ""}`}
        >
          <TreeLabel text={node.name} query={treeQuery} />
        </span>
        {isCurateable && (
          <CurationPill
            state={curationState}
            onCycle={() => curate!.cycleState(node.id)}
            size="xs"
          />
        )}
        {node.tokens !== undefined && (
          <span className="shrink-0 font-mono text-[9px] text-[var(--hg-muted)]">
            {formatAnalysisTokens(node.tokens)}
          </span>
        )}
      </button>
      {hasChildren &&
        isExpanded &&
        node.children!.map((child) => (
          <ContextTreeBranch
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selectedNodeId={selectedNodeId}
            treeQuery={treeQuery}
            onToggle={onToggle}
            onSelect={onSelect}
            curate={curate}
          />
        ))}
    </>
  );
}

function TreeLabel({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return text;

  const lower = text.toLowerCase();
  const index = lower.indexOf(q);
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[1px] bg-[var(--hg-accent)]/25 text-[var(--hg-ink)]">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}

function ContextEditorPane({
  session,
  snapshot,
  node,
  viewMode,
  blockDrafts,
  contextNodeDrafts,
  onBlockDraftChange,
  onContextNodeDraftChange,
}: {
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  node: ContextTreeNode | null;
  viewMode: ContextViewMode;
  blockDrafts: Record<string, string>;
  contextNodeDrafts: Record<string, string>;
  onBlockDraftChange: (blockId: string, body: string) => void;
  onContextNodeDraftChange: (nodeId: string, body: string) => void;
}) {
  const sourceDoc = useMemo(
    () => (node ? buildEditorDocument(session, snapshot, node, {}, viewMode) : null),
    [session, snapshot, node, viewMode],
  );

  const content = useMemo(
    () => (node ? buildEditorDocument(session, snapshot, node, blockDrafts, viewMode) : null),
    [session, snapshot, node, blockDrafts, viewMode],
  );

  const code = useMemo(() => {
    if (!node || !content) return "";
    if (node.kind === "block" && node.blockId) {
      return blockDrafts[node.blockId] ?? content.lines.join("\n");
    }
    return contextNodeDrafts[node.id] ?? content.lines.join("\n");
  }, [node, content, blockDrafts, contextNodeDrafts]);

  const isDirty = useMemo(() => {
    if (!node || !sourceDoc) return false;
    const baseline = sourceDoc.lines.join("\n");
    return code !== baseline;
  }, [node, sourceDoc, code]);

  const onChange = useCallback(
    (next: string) => {
      if (!node) return;
      if (node.kind === "block" && node.blockId) {
        onBlockDraftChange(node.blockId, next);
        return;
      }
      onContextNodeDraftChange(node.id, next);
    },
    [node, onBlockDraftChange, onContextNodeDraftChange],
  );

  if (!node || !content) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0d1114] text-[13px] text-[var(--hg-muted)]">
        Select a context file in the tree
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#0d1114]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--hg-line)] bg-[#101518] px-4 py-2">
        <FileCode2 size={14} className="shrink-0 text-[var(--hg-accent)]" />
        <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--hg-ink)]">
          {node.path.join(" / ")}
        </div>
        {content.badge && <span className="hg-pill">{content.badge}</span>}
        {isDirty && (
          <span className="hg-pill accent" title="Local draft — not written back to the source transcript">
            draft
          </span>
        )}
        {node.kind === "atom" && content.sourceTruncated && (
          <span className="hg-pill" title="Truncated in the source transcript, not by Contextual">
            source clipped
          </span>
        )}
      </div>

      {content.meta.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-b border-[var(--hg-line)] bg-[#101518] px-4 py-1.5 font-mono text-[10px] text-[var(--hg-muted)]">
          {content.meta.map(([key, value]) => (
            <span key={key}>
              {key}: <span className="text-[var(--hg-ink-2)]">{value}</span>
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <CodeEditor
          key={node.id}
          code={code}
          language={inferDocumentLanguage(node, content.tone ?? "plain", code)}
          filename={node.path[node.path.length - 1]}
          onChange={onChange}
          showLineNumbers
          className="h-full min-h-0"
        />
      </div>
    </div>
  );
}

type EditorTone = "plain" | "markdown" | "yaml-frontmatter" | "code";

function inferDocumentLanguage(
  node: ContextTreeNode,
  tone: EditorTone,
  text: string,
): DocumentLanguage {
  const filename = node.path[node.path.length - 1]?.toLowerCase() ?? "";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".md") || filename.endsWith(".mdx")) return "markdown";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".html") || filename.endsWith(".htm")) return "html";
  if (filename.endsWith(".sh")) return "shell";
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(filename)) return "typescript";

  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(text);
      return "json";
    } catch {
      // fall through
    }
  }

  if (tone === "code") return "typescript";
  if (tone === "markdown" || tone === "yaml-frontmatter") return "markdown";
  return "plain";
}

interface EditorDocument {
  lines: string[];
  meta: Array<[string, string]>;
  badge?: string;
  tone?: EditorTone;
  sourceTruncated?: boolean;
}

function buildEditorDocument(
  session: SessionAnalysis,
  snapshot: ThresholdSnapshot,
  node: ContextTreeNode,
  blockDrafts: Record<string, string>,
  viewMode: ContextViewMode = "contextual",
): EditorDocument {
  if (node.kind === "overview") {
    if (viewMode === "raw") {
      const corpusTokens = session.atoms.reduce((sum, atom) => sum + atom.tokens, 0);
      return {
        badge: "overview",
        tone: "markdown",
        meta: [
          ["project", session.project],
          ["id", `…${sessionIdSuffix(session.id)}`],
          ["touched", formatObservedRelative(session.observedAt)],
          ["corpus", formatAnalysisTokens(corpusTokens)],
        ],
        lines: [
          `# ${displaySessionTitle(session.title)}`,
          "",
          session.summary,
          "",
          "## transcript",
          `- atoms: ${session.atoms.length}`,
          `- corpus: ${formatAnalysisTokens(corpusTokens)}`,
          `- reported context: ${formatAnalysisTokens(session.contextTokens)}`,
          "",
          "Raw view shows verbatim harness records in message order.",
          "No bucket labels, pinned/tail packing, or threshold simulation.",
          "",
          "## path",
          session.path,
        ],
      };
    }

    return {
      badge: "overview",
      tone: "markdown",
      meta: [
        ["project", session.project],
        ["id", `…${sessionIdSuffix(session.id)}`],
        ["touched", formatObservedRelative(session.observedAt)],
        ["window", formatAnalysisTokens(snapshot.coveredTokens)],
      ],
      lines: [
        `# ${displaySessionTitle(session.title)}`,
        "",
        session.summary,
        "",
        "## window",
        `- threshold: ${formatAnalysisTokens(snapshot.threshold)}`,
        `- covered: ${formatAnalysisTokens(snapshot.coveredTokens)}`,
        `- pinned: ${formatAnalysisTokens(snapshot.pinnedTokens)}`,
        `- tail: ${formatAnalysisTokens(snapshot.tailTokens)}`,
        `- strategy: ${snapshot.strategy}`,
        "",
        "## corpus",
        `- atoms: ${session.atoms.length}`,
        `- slices: ${session.slices.length}`,
        `- blocks: ${session.recipeDraft.blocks.length}`,
        "",
        "## path",
        session.path,
      ],
    };
  }

  if (node.kind === "atom" && node.atomId) {
    const atom = session.atoms.find((item) => item.id === node.atomId);
    if (!atom) return emptyDoc("atom missing");
    return atomDocument(atom, viewMode);
  }

  if (node.kind === "block" && node.blockId) {
    const block = session.recipeDraft.blocks.find((item) => item.id === node.blockId);
    if (!block) return emptyDoc("block missing");
    const body = blockDrafts[block.id] ?? block.body;
    return blockDocument(block, body);
  }

  if (node.kind === "slice" && node.sliceId) {
    const slice = session.slices.find((item) => item.id === node.sliceId);
    if (!slice) return emptyDoc("slice missing");
    return sliceDocument(session, slice, snapshot);
  }

  if (node.id === "context:transcript") {
    const ordered = [...session.atoms].sort((a, b) => a.messageIndex - b.messageIndex);
    return {
      badge: "transcript",
      tone: "markdown",
      meta: [
        ["atoms", String(ordered.length)],
        ["order", "message index"],
      ],
      lines: [
        "# transcript",
        "",
        "Full session corpus in harness message order.",
        "Open individual `.atom` files for verbatim record bodies.",
        "",
        `atoms: ${ordered.length}`,
      ],
    };
  }

  return {
    badge: "folder",
    tone: "markdown",
    meta: node.detail ? [["note", node.detail]] : [],
    lines: [
      `# ${node.name}`,
      "",
      node.detail ?? "Expand folders in the tree to open atoms, slices, and recipe blocks.",
      "",
      `path: ${node.path.join("/")}`,
    ],
  };
}

function atomDocument(atom: ContextAtom, viewMode: ContextViewMode = "contextual"): EditorDocument {
  if (viewMode === "raw") {
    const fields: Array<[string, string]> = [
      ["kind", "atom"],
      ["source", atom.sourceType],
      ["tokens", formatAnalysisTokens(atom.rawTokenCount || atom.tokens)],
    ];
    if (atom.role) fields.push(["role", atom.role]);
    if (atom.toolName) fields.push(["tool", atom.toolName]);
    if (atom.lineNumber) fields.push(["line", String(atom.lineNumber)]);
    if (atom.messageIndex >= 0) fields.push(["message", String(atom.messageIndex)]);
    if (atom.command) fields.push(["command", atom.command]);
    if (atom.excerptTruncated) {
      fields.push([
        "source clip",
        atom.sourceTokenCount
          ? `harness truncated (~${formatAnalysisTokens(atom.sourceTokenCount)} original)`
          : "harness truncated",
      ]);
    }

    return {
      badge: atom.sourceType,
      meta: fields,
      lines: [
        "---",
        `label: ${atom.label}`,
        ...(atom.lineNumber ? [`line: ${atom.lineNumber}`] : []),
        "---",
        "",
        atom.excerpt || atom.summary,
        ...(atom.fileRefs.length ? ["", "files:", ...atom.fileRefs.map((ref) => `  - ${ref}`)] : []),
      ],
      tone: editorToneForAtom(atom),
      sourceTruncated: atom.excerptTruncated,
    };
  }

  const meta = bucketMeta(atom.bucket);
  const fields: Array<[string, string]> = [
    ["kind", "atom"],
    ["bucket", meta.label],
    ["tokens", formatAnalysisTokens(atom.tokens)],
    ["source", atom.sourceType],
    ["artifact", atom.artifactType],
    ["stability", atom.stability],
  ];
  if (atom.lineNumber) fields.push(["line", String(atom.lineNumber)]);
  if (atom.command) fields.push(["command", atom.command]);
  if (atom.pinned) fields.push(["window", "pinned"]);
  if (atom.excerptTruncated) {
    fields.push([
      "source clip",
      atom.sourceTokenCount
        ? `harness truncated (~${formatAnalysisTokens(atom.sourceTokenCount)} original)`
        : "harness truncated",
    ]);
  }

  const lines = [
    "---",
    `label: ${atom.label}`,
    `summary: ${atom.summary}`,
    "---",
    "",
    atom.excerpt || atom.summary,
  ];
  if (atom.fileRefs.length) lines.push("", "files:", ...atom.fileRefs.map((ref) => `  - ${ref}`));

  return { badge: atom.bucket, meta: fields, lines, tone: editorToneForAtom(atom), sourceTruncated: atom.excerptTruncated };
}

function editorToneForAtom(atom: ContextAtom): EditorTone {
  if (
    atom.sourceType === "tool-output" ||
    atom.artifactType === "command-output" ||
    atom.artifactType === "diff" ||
    atom.artifactType === "file-read"
  ) {
    return "code";
  }
  if (atom.artifactType === "instruction" || atom.bucket === "task") return "markdown";
  return "yaml-frontmatter";
}

function blockDocument(block: ContextBlock, body: string): EditorDocument {
  return {
    badge: block.quality,
    meta: [
      ["kind", block.kind],
      ["bucket", bucketMeta(block.bucket).label],
      ["draft", formatAnalysisTokens(block.tokens)],
      ["source", formatAnalysisTokens(block.sourceTokens)],
      ["lifecycle", block.lifecycle],
    ],
    lines: body.split("\n"),
    tone: block.bucket === "codebase" ? "code" : "markdown",
  };
}

function sliceDocument(session: SessionAnalysis, slice: ContextSlice, snapshot: ThresholdSnapshot): EditorDocument {
  const snapshotAtomIds = new Set(snapshot.chunkRefs);
  const atoms = slice.atomRefs
    .filter((id) => snapshotAtomIds.has(id))
    .map((id) => session.atoms.find((atom) => atom.id === id))
    .filter((atom): atom is ContextAtom => Boolean(atom));

  const lines = [
    `# ${slice.title}`,
    "",
    slice.summary,
    "",
    `lifecycle: ${slice.lifecycle}`,
    `artifact: ${slice.artifactType}`,
    `scope: ${slice.repoScope}`,
    `stability: ${slice.stability}`,
    "",
    "## atoms",
    "",
  ];

  for (const atom of atoms) {
    lines.push(`### ${atom.label} (${formatAnalysisTokens(atom.tokens)})`, "", atom.excerpt || atom.summary, "");
  }

  return {
    badge: slice.quality,
    meta: [
      ["bucket", bucketMeta(slice.bucket).label],
      ["tokens", formatAnalysisTokens(slice.tokens)],
      ["atoms", String(atoms.length)],
    ],
    lines,
    tone: "markdown",
  };
}

function emptyDoc(message: string): EditorDocument {
  return { lines: [message], meta: [] };
}

type HarnessKeyStatus = "idle" | "loading" | "ready" | "error";

function HarnessFallback({
  status,
  keyMissing,
  error,
}: {
  status: HarnessKeyStatus;
  keyMissing: boolean;
  error?: string;
}) {
  let message: string;
  if (status === "loading") message = "Resolving session in harness catalog…";
  else if (status === "error") message = error ?? "Failed to resolve harness session.";
  else if (keyMissing)
    message =
      "This session isn't indexed by the harness catalog. Contextual view still works; harness-native data is unavailable.";
  else message = error ?? "Harness data unavailable.";

  return (
    <div className="flex flex-1 items-center justify-center bg-[#0d1114] px-6 text-center text-[12px] text-[var(--hg-muted)]">
      <span className="max-w-md leading-relaxed">{message}</span>
    </div>
  );
}

function AtRestEditorPane({
  node,
  harnessKeyStatus,
  harnessKey,
  harnessError,
  status,
  totalLines,
  loadedLines,
  line,
}: {
  node: ContextTreeNode | null;
  harnessKeyStatus: HarnessKeyStatus;
  harnessKey: string | null;
  harnessError?: string;
  status: HarnessKeyStatus;
  totalLines: number;
  loadedLines: number;
  line: AtRestLine | null;
}) {
  if (harnessKeyStatus !== "ready" || !harnessKey) {
    return (
      <HarnessFallback
        status={harnessKeyStatus}
        keyMissing={harnessKeyStatus === "ready" && !harnessKey}
        error={harnessError}
      />
    );
  }

  if (status === "loading" && !line && node?.id !== AT_REST_OVERVIEW_NODE_ID) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0d1114] text-[12px] text-[var(--hg-muted)]">
        Loading at-rest lines…
      </div>
    );
  }

  if (status === "error") {
    return (
      <HarnessFallback status="error" keyMissing={false} error={harnessError} />
    );
  }

  if (node?.id === AT_REST_OVERVIEW_NODE_ID || !line) {
    const overview = [
      "# at-rest",
      "",
      "Native JSONL records as they live on disk.",
      "Pick a line in the tree to inspect its parsed JSON.",
      "",
      `lines loaded: ${loadedLines} / ${totalLines}`,
    ].join("\n");
    return (
      <div className="flex min-w-0 flex-1 flex-col bg-[#0d1114]">
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--hg-line)] bg-[#101518] px-4 py-2">
          <FileCode2 size={14} className="shrink-0 text-[var(--hg-accent)]" />
          <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--hg-ink)]">
            at-rest / session.json
          </div>
          <span className="hg-pill">overview</span>
        </div>
        <div className="min-h-0 flex-1">
          <CodeEditor
            key="at-rest:overview"
            code={overview}
            language="markdown"
            filename="session.md"
            showLineNumbers
            className="h-full min-h-0"
            onChange={() => {
              // read-only overview
            }}
          />
        </div>
      </div>
    );
  }

  const json = safeStringifyJson(line.native);
  const meta: Array<[string, string]> = [
    ["line", String(line.line)],
    ["record", line.recordType],
  ];
  if (line.role) meta.push(["role", line.role]);
  if (line.timestamp) meta.push(["timestamp", line.timestamp]);
  if (line.turnId) meta.push(["turn", line.turnId]);
  if (line.source.path) meta.push(["source", `${line.source.path}:${line.line}`]);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#0d1114]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--hg-line)] bg-[#101518] px-4 py-2">
        <FileCode2 size={14} className="shrink-0 text-[var(--hg-accent)]" />
        <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--hg-ink)]">
          {node?.path.join(" / ") ?? `line ${line.line}`}
        </div>
        <span className="hg-pill">{line.recordType}</span>
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-b border-[var(--hg-line)] bg-[#101518] px-4 py-1.5 font-mono text-[10px] text-[var(--hg-muted)]">
        {meta.map(([k, v]) => (
          <span key={k}>
            {k}: <span className="text-[var(--hg-ink-2)]">{v}</span>
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          key={`at-rest:${line.line}`}
          code={json}
          language="json"
          filename={`line-${line.line}.json`}
          showLineNumbers
          className="h-full min-h-0"
          onChange={() => {
            // at-rest is read-only
          }}
        />
      </div>
    </div>
  );
}

function TurnReadyEditorPane({
  node,
  harnessKeyStatus,
  harnessKey,
  harnessError,
  status,
  manifest,
  turns,
  selectedTurn,
  onSelectTurn,
  part,
}: {
  node: ContextTreeNode | null;
  harnessKeyStatus: HarnessKeyStatus;
  harnessKey: string | null;
  harnessError?: string;
  status: HarnessKeyStatus;
  manifest: TurnReadyManifest | null;
  turns: TurnRecord[];
  selectedTurn: "latest" | string;
  onSelectTurn: (turn: "latest" | string) => void;
  part: ManifestPart | null;
}) {
  if (harnessKeyStatus !== "ready" || !harnessKey) {
    return (
      <HarnessFallback
        status={harnessKeyStatus}
        keyMissing={harnessKeyStatus === "ready" && !harnessKey}
        error={harnessError}
      />
    );
  }

  if (status === "loading" && !manifest) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0d1114] text-[12px] text-[var(--hg-muted)]">
        Loading turn-ready manifest…
      </div>
    );
  }

  if (status === "error" || !manifest) {
    return (
      <HarnessFallback
        status="error"
        keyMissing={false}
        error={harnessError ?? "Manifest unavailable."}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#0d1114]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--hg-line)] bg-[#101518] px-4 py-2">
        <FileCode2 size={14} className="shrink-0 text-[var(--hg-accent)]" />
        <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--hg-ink)]">
          {node?.path.join(" / ") ?? "turn-ready / manifest.json"}
        </div>
        <AssemblyBadge assembly={manifest.assembly} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--hg-line)] bg-[#101518] px-4 py-1.5 font-mono text-[10px] text-[var(--hg-muted)]">
        <label className="flex items-center gap-1">
          <span className="uppercase tracking-wider">turn:</span>
          <select
            value={selectedTurn}
            onChange={(e) => onSelectTurn(e.target.value as "latest" | string)}
            className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--hg-ink)] focus:border-[var(--hg-accent)] focus:outline-none"
          >
            <option value="latest">latest</option>
            {turns.map((t) => (
              <option key={t.id} value={t.id}>
                {turnLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <span>
          parts: <span className="text-[var(--hg-ink-2)]">{manifest.parts.length}</span>
        </span>
        {manifest.tokenBudget.estimatedInputTokens != null && (
          <span>
            est tokens:{" "}
            <span className="text-[var(--hg-ink-2)]">
              {formatAnalysisTokens(manifest.tokenBudget.estimatedInputTokens)}
            </span>
          </span>
        )}
        {manifest.model && (
          <span>
            model: <span className="text-[var(--hg-ink-2)]">{manifest.model}</span>
          </span>
        )}
      </div>

      {manifest.warnings.length > 0 && (
        <div className="flex shrink-0 items-start gap-2 border-b border-[var(--hg-line)] bg-[color:rgb(120_80_20_/_0.18)] px-4 py-2 font-mono text-[10px] text-amber-200">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <ul className="list-none space-y-0.5">
            {manifest.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <ManifestBody node={node} manifest={manifest} part={part} />
    </div>
  );
}

function ManifestBody({
  node,
  manifest,
  part,
}: {
  node: ContextTreeNode | null;
  manifest: TurnReadyManifest;
  part: ManifestPart | null;
}) {
  if (node?.id === TURN_READY_OVERVIEW_NODE_ID || !part) {
    const overview = [
      "# turn-ready manifest",
      "",
      `assembly: ${manifest.assembly.status}`,
      `confidence: ${manifest.assembly.confidence}`,
      `adapter: ${manifest.adapterVersion}`,
      manifest.cwd ? `cwd: ${manifest.cwd}` : "",
      "",
      "## parts",
      ...manifest.parts.map(
        (p) => `- ${String(p.order).padStart(2, "0")} ${p.kind} · truth=${p.truth}`,
      ),
    ]
      .filter(Boolean)
      .join("\n");
    return (
      <div className="min-h-0 flex-1">
        <CodeEditor
          key={`manifest-overview:${manifest.id}`}
          code={overview}
          language="markdown"
          filename="manifest.md"
          showLineNumbers
          className="h-full min-h-0"
          onChange={() => {
            // turn-ready is read-only
          }}
        />
      </div>
    );
  }

  const lang: DocumentLanguage =
    part.kind === "tool-call" || part.kind === "tool-result" || part.kind === "reasoning"
      ? "json"
      : part.kind === "system" ||
          part.kind === "developer" ||
          part.kind === "user" ||
          part.kind === "assistant" ||
          part.kind === "compact-summary"
        ? "markdown"
        : "plain";

  const body =
    part.content ??
    (part.native != null ? safeStringifyJson(part.native) : `[content unavailable — truth=${part.truth}]`);

  const meta: Array<[string, string]> = [
    ["kind", part.kind],
    ["truth", part.truth],
    ["transfer", part.transfer],
  ];
  if (part.role) meta.push(["role", part.role]);
  if (part.tokens != null) meta.push(["tokens", formatAnalysisTokens(part.tokens)]);
  if (part.sourceRefs[0]?.path) {
    const ref = part.sourceRefs[0];
    meta.push(["source", ref.line ? `${ref.path}:${ref.line}` : ref.path!]);
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--hg-line)] bg-[#101518] px-4 py-1.5 font-mono text-[10px] text-[var(--hg-muted)]">
        <TruthPill truth={part.truth} />
        {meta.map(([k, v]) => (
          <span key={k}>
            {k}: <span className="text-[var(--hg-ink-2)]">{v}</span>
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <CodeEditor
          key={`manifest-part:${manifest.id}:${part.id}`}
          code={body}
          language={lang}
          filename={`${part.order}-${part.kind}`}
          showLineNumbers
          className="h-full min-h-0"
          onChange={() => {
            // turn-ready is read-only
          }}
        />
      </div>
    </>
  );
}

function AssemblyBadge({ assembly }: { assembly: TurnReadyManifest["assembly"] }) {
  const tone =
    assembly.confidence === "high"
      ? "accent"
      : assembly.confidence === "medium"
        ? ""
        : "warn";
  return (
    <span
      className={`hg-pill ${tone}`}
      title={`status: ${assembly.status} · confidence: ${assembly.confidence}`}
    >
      {assembly.status} · {assembly.confidence}
    </span>
  );
}

function TruthPill({ truth }: { truth: ManifestTruth }) {
  const tone =
    truth === "logged"
      ? "accent"
      : truth === "reconstructed"
        ? ""
        : truth === "inferred"
          ? "warn"
          : "warn";
  return (
    <span className={`hg-pill ${tone}`} title={`truth: ${truth}`}>
      {truth}
    </span>
  );
}

function safeStringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
