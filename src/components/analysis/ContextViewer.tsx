import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  FolderClosed,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";

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
  buildContextTree,
  collectExpandedContextPaths,
  collectMatchContextPaths,
  defaultContextNodeId,
  filterContextTree,
  findContextNode,
  flattenContextTree,
  type ContextTreeNode,
} from "@/lib/contextTree";
import { displaySessionTitle } from "@/lib/sessionLabel";
import { sessionIdSuffix, sessionNavMeta } from "@/lib/sessionNavLabel";
import { formatObservedRelative } from "@/lib/sessionExplore";

const TREE_WIDTH = 260;

interface ContextViewerProps {
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  blockDrafts: Record<string, string>;
  sessionsPanelCollapsed?: boolean;
  onToggleSessionsPanel?: () => void;
}

export function ContextViewer({
  session,
  snapshot,
  selectedNodeId,
  onSelectNode,
  blockDrafts,
  sessionsPanelCollapsed,
  onToggleSessionsPanel,
}: ContextViewerProps) {
  const tree = useMemo(() => buildContextTree(session, snapshot), [session, snapshot]);
  const [treeQuery, setTreeQuery] = useState("");
  const filteredTree = useMemo(
    () => (treeQuery.trim() ? filterContextTree(tree, treeQuery) : tree),
    [tree, treeQuery],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => collectExpandedContextPaths(tree));

  useEffect(() => {
    setExpanded(
      treeQuery.trim()
        ? collectMatchContextPaths(tree, treeQuery)
        : collectExpandedContextPaths(tree),
    );
  }, [session.id, snapshot.threshold, tree, treeQuery]);

  useEffect(() => {
    if (!filteredTree) return;
    if (!findContextNode(filteredTree, selectedNodeId)) {
      onSelectNode(defaultContextNodeId(filteredTree));
    }
  }, [filteredTree, selectedNodeId, onSelectNode]);

  const selected = filteredTree ? findContextNode(filteredTree, selectedNodeId) : null;
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-3 py-1.5">
        {onToggleSessionsPanel && (
          <button
            type="button"
            onClick={onToggleSessionsPanel}
            className="inline-flex items-center gap-1 rounded-[2px] border border-[var(--hg-line)] px-2 py-1 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)] hover:text-[var(--hg-ink)]"
            title={sessionsPanelCollapsed ? "Show sessions panel" : "Hide sessions panel"}
          >
            {sessionsPanelCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
            sessions
          </button>
        )}
        <span className="hg-mono text-[10px] text-[var(--hg-muted)] truncate">
          {sessionNavMeta(session)} · {formatAnalysisTokens(snapshot.threshold)} window
        </span>
        <span className="ml-auto shrink-0 hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
          contextual model
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className="shrink-0 overflow-auto border-r border-[var(--hg-line)] bg-[var(--hg-surface)]"
          style={{ width: TREE_WIDTH }}
        >
          <div className="border-b border-[var(--hg-line)] px-3 py-2">
            <div className="hg-section-label">context</div>
            <div className="mt-0.5 text-[10px] leading-snug text-[var(--hg-muted)]">
              verbatim transcript atoms · contextual buckets &amp; slices
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
          <div className="py-1">
            {(visibleTree.children ?? []).map((node) => (
              <ContextTreeBranch
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                selectedNodeId={selectedNodeId}
                treeQuery={treeQuery}
                onToggle={toggleExpanded}
                onSelect={onSelectNode}
              />
            ))}
          </div>
        </aside>

        <ContextEditorPane
          session={session}
          snapshot={snapshot}
          node={selected}
          blockDrafts={blockDrafts}
        />
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
}: {
  node: ContextTreeNode;
  depth: number;
  expanded: Set<string>;
  selectedNodeId: string;
  treeQuery: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
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

  return (
    <>
      <button
        type="button"
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
        style={{ paddingLeft: 8 + depth * 14 }}
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
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-none">
          <TreeLabel text={node.name} query={treeQuery} />
        </span>
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
  blockDrafts,
}: {
  session: SessionAnalysis;
  snapshot: ThresholdSnapshot;
  node: ContextTreeNode | null;
  blockDrafts: Record<string, string>;
}) {
  const content = useMemo(
    () => (node ? buildEditorDocument(session, snapshot, node, blockDrafts) : null),
    [session, snapshot, node, blockDrafts],
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

      <div className="min-h-0 flex-1 overflow-auto">
        <LineNumberedDocument lines={content.lines} tone={content.tone} />
      </div>
    </div>
  );
}

function LineNumberedDocument({
  lines,
  tone = "plain",
}: {
  lines: string[];
  tone?: EditorTone;
}) {
  const width = String(lines.length).length;
  return (
    <div className="min-w-full py-3 font-mono text-[13px] leading-[1.65] text-[#d6dde3]">
      {lines.map((line, index) => (
        <div
          key={index}
          className="grid hover:bg-white/[0.03]"
          style={{ gridTemplateColumns: `${width + 2}ch 1fr` }}
        >
          <span className="select-none pr-3 text-right text-[#5c6770]">{index + 1}</span>
          <span className="whitespace-pre-wrap break-words pr-6">
            <EditorLine line={line} tone={tone} />
          </span>
        </div>
      ))}
    </div>
  );
}

type EditorTone = "plain" | "markdown" | "yaml-frontmatter" | "code";

function EditorLine({ line, tone }: { line: string; tone: EditorTone }) {
  if (!line) return " ";

  if (tone === "yaml-frontmatter") {
    if (line === "---") return <span className="text-[#6a737d]">{line}</span>;
    const colon = line.indexOf(":");
    if (colon > 0) {
      return (
        <>
          <span className="text-[#79b8ff]">{line.slice(0, colon)}</span>
          <span className="text-[#6a737d]">:</span>
          <span className="text-[#9ecbff]">{line.slice(colon + 1)}</span>
        </>
      );
    }
  }

  if (tone === "markdown" || tone === "yaml-frontmatter") {
    if (line.startsWith("#")) {
      const match = line.match(/^(#+)\s+(.*)$/);
      if (match) {
        return (
          <>
            <span className="text-[#6a737d]">{match[1]} </span>
            <span className="text-[#e6edf3]">{match[2]}</span>
          </>
        );
      }
    }
    if (line.startsWith("- ")) {
      return (
        <>
          <span className="text-[#6a737d]">- </span>
          <span>{line.slice(2)}</span>
        </>
      );
    }
    if (line.startsWith("[") && line.includes("]")) {
      return <span className="text-[#d4a574]">{line}</span>;
    }
  }

  if (tone === "code") {
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("#")) {
      return <span className="text-[#6a737d]">{line}</span>;
    }
    if (line.includes("function ") || line.includes("const ") || line.includes("import ")) {
      return <span className="text-[#79b8ff]">{line}</span>;
    }
  }

  return line;
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
): EditorDocument {
  if (node.kind === "overview") {
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
    return atomDocument(atom);
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

function atomDocument(atom: ContextAtom): EditorDocument {
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
