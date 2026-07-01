"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchHarnessAtRest,
  fetchHarnessManifest,
  fetchHarnessTurns,
  resolveHarnessSessionKey,
  type AtRestLine,
  type HarnessSessionKey,
  type ManifestPart,
  type TurnReadyManifest,
  type TurnRecord,
} from "@/lib/harnessContract";

import type { ContextTreeNode } from "@/lib/contextTree";

const AT_REST_PAGE_SIZE = 200;

type Status = "idle" | "loading" | "ready" | "error";

export interface HarnessKeyState {
  status: Status;
  key: HarnessSessionKey | null;
  error?: string;
}

export function useHarnessSessionKey(sessionPath: string | undefined): HarnessKeyState {
  const [state, setState] = useState<HarnessKeyState>({ status: "idle", key: null });
  const cacheRef = useRef(new Map<string, HarnessSessionKey | null>());

  useEffect(() => {
    if (!sessionPath) {
      setState({ status: "idle", key: null });
      return;
    }
    const cached = cacheRef.current.get(sessionPath);
    if (cached !== undefined) {
      setState({ status: "ready", key: cached });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", key: null });
    resolveHarnessSessionKey(sessionPath)
      .then((key) => {
        if (cancelled) return;
        cacheRef.current.set(sessionPath, key);
        setState({ status: "ready", key });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          key: null,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionPath]);

  return state;
}

export interface AtRestState {
  status: Status;
  lines: AtRestLine[];
  totalLines: number;
  nextFromLine: number | null;
  error?: string;
  loadMore: () => void;
  loadingMore: boolean;
}

export function useHarnessAtRest(key: HarnessSessionKey | null): AtRestState {
  const [lines, setLines] = useState<AtRestLine[]>([]);
  const [totalLines, setTotalLines] = useState(0);
  const [nextFromLine, setNextFromLine] = useState<number | null>(1);
  const [status, setStatus] = useState<Status>("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const activeKeyRef = useRef<HarnessSessionKey | null>(null);

  useEffect(() => {
    activeKeyRef.current = key;
    setLines([]);
    setTotalLines(0);
    setNextFromLine(1);
    setError(undefined);
    if (!key) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetchHarnessAtRest(key, { fromLine: 1, limit: AT_REST_PAGE_SIZE })
      .then((res) => {
        if (cancelled || activeKeyRef.current !== key) return;
        setLines(res.lines);
        setTotalLines(res.totalLines);
        setNextFromLine(res.nextFromLine);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled || activeKeyRef.current !== key) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const loadMore = useCallback(() => {
    if (!key || nextFromLine == null || loadingMore) return;
    setLoadingMore(true);
    fetchHarnessAtRest(key, { fromLine: nextFromLine, limit: AT_REST_PAGE_SIZE })
      .then((res) => {
        if (activeKeyRef.current !== key) return;
        setLines((prev) => [...prev, ...res.lines]);
        setTotalLines(res.totalLines);
        setNextFromLine(res.nextFromLine);
      })
      .catch((err) => {
        if (activeKeyRef.current !== key) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (activeKeyRef.current === key) setLoadingMore(false);
      });
  }, [key, nextFromLine, loadingMore]);

  return { status, lines, totalLines, nextFromLine, error, loadMore, loadingMore };
}

export interface TurnsState {
  status: Status;
  turns: TurnRecord[];
  error?: string;
}

export function useHarnessTurns(key: HarnessSessionKey | null): TurnsState {
  const [state, setState] = useState<TurnsState>({ status: "idle", turns: [] });

  useEffect(() => {
    if (!key) {
      setState({ status: "idle", turns: [] });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", turns: [] });
    fetchHarnessTurns(key)
      .then((res) => {
        if (!cancelled) setState({ status: "ready", turns: res.turns });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          turns: [],
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}

export interface ManifestState {
  status: Status;
  manifest: TurnReadyManifest | null;
  error?: string;
}

export function useHarnessManifest(
  key: HarnessSessionKey | null,
  turn: "latest" | string | number,
): ManifestState {
  const [state, setState] = useState<ManifestState>({ status: "idle", manifest: null });

  useEffect(() => {
    if (!key) {
      setState({ status: "idle", manifest: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", manifest: null });
    fetchHarnessManifest(key, turn)
      .then((res) => {
        if (!cancelled) setState({ status: "ready", manifest: res });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          manifest: null,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [key, turn]);

  return state;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function slugRecordType(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "record"
  );
}

export const AT_REST_OVERVIEW_NODE_ID = "at-rest:overview";
export const TURN_READY_OVERVIEW_NODE_ID = "turn-ready:overview";

export function atRestNodeId(line: number): string {
  return `at-rest:line:${line}`;
}

export function turnReadyPartNodeId(order: number): string {
  return `turn-ready:part:${order}`;
}

export interface AtRestTree {
  tree: ContextTreeNode;
  linesByNodeId: Map<string, AtRestLine>;
}

export function buildAtRestTree(lines: AtRestLine[], totalLines: number): AtRestTree {
  const width = Math.max(3, String(totalLines || lines.length || 1).length);
  const linesByNodeId = new Map<string, AtRestLine>();

  const leaves: ContextTreeNode[] = lines.map((line) => {
    const name = `${pad(line.line, width)}-${slugRecordType(line.recordType)}.json`;
    const id = atRestNodeId(line.line);
    linesByNodeId.set(id, line);
    return {
      id,
      name,
      path: ["at-rest", "lines", name],
      kind: "atom",
      detail: line.role ? `${line.recordType} · ${line.role}` : line.recordType,
    };
  });

  const tree: ContextTreeNode = {
    id: "at-rest:root",
    name: "at-rest",
    path: ["at-rest"],
    kind: "folder",
    children: [
      {
        id: AT_REST_OVERVIEW_NODE_ID,
        name: "session.json",
        path: ["at-rest", "session.json"],
        kind: "overview",
        detail: `${totalLines} jsonl lines`,
      },
      {
        id: "at-rest:lines",
        name: "lines",
        path: ["at-rest", "lines"],
        kind: "folder",
        detail: `${lines.length} / ${totalLines}`,
        children: leaves,
      },
    ],
  };

  return { tree, linesByNodeId };
}

export interface TurnReadyTree {
  tree: ContextTreeNode;
  partsByNodeId: Map<string, ManifestPart>;
}

export function buildTurnReadyTree(manifest: TurnReadyManifest | null): TurnReadyTree {
  const partsByNodeId = new Map<string, ManifestPart>();

  if (!manifest) {
    return {
      tree: {
        id: "turn-ready:root",
        name: "turn-ready",
        path: ["turn-ready"],
        kind: "folder",
        children: [],
      },
      partsByNodeId,
    };
  }

  const width = Math.max(2, String(manifest.parts.length || 1).length);
  const leaves: ContextTreeNode[] = manifest.parts.map((part) => {
    const id = turnReadyPartNodeId(part.order);
    const name = `${pad(part.order, width)}-${slugRecordType(part.kind)}`;
    partsByNodeId.set(id, part);
    return {
      id,
      name,
      path: ["turn-ready", "manifest", "parts", name],
      kind: "atom",
      tokens: part.tokens,
      detail: part.title ?? part.kind,
    };
  });

  const tree: ContextTreeNode = {
    id: "turn-ready:root",
    name: "turn-ready",
    path: ["turn-ready"],
    kind: "folder",
    children: [
      {
        id: TURN_READY_OVERVIEW_NODE_ID,
        name: "manifest.json",
        path: ["turn-ready", "manifest.json"],
        kind: "overview",
        detail: `${manifest.assembly.status} · confidence ${manifest.assembly.confidence}`,
      },
      {
        id: "turn-ready:parts",
        name: "parts",
        path: ["turn-ready", "manifest", "parts"],
        kind: "folder",
        detail: `${manifest.parts.length} parts`,
        children: leaves,
      },
    ],
  };

  return { tree, partsByNodeId };
}

export function turnLabel(turn: TurnRecord): string {
  const title = turn.title?.trim();
  if (title) return `#${turn.index + 1} · ${title.slice(0, 60)}`;
  return `#${turn.index + 1}`;
}

export function turnPickerValue(turn: TurnRecord | null | undefined): "latest" | string {
  return turn ? turn.id : "latest";
}
