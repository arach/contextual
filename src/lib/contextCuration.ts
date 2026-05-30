"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ContextTreeNode } from "@/lib/contextTree";
import { flattenContextTree } from "@/lib/contextTree";

/**
 * Curation layer: per-node "keep / summarize / drop" state for shaping a
 * request before sending. Scoped to contextual mode — at-rest and turn-ready
 * are logged data and should not pretend to be editable.
 *
 * The store is path-keyed (not node-id keyed) so that switching threshold
 * snapshots doesn't lose decisions about the same atom. Persisted in
 * localStorage under one key per session id.
 */

export type CurationState = "keep" | "summarize" | "drop";

export type CurationStateMap = Record<string, CurationState>;

export interface CurationRollup {
  raw: number;
  kept: number;
  summarized: number;
  dropped: number;
  delta: number;
}

export interface CurationApi {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  states: CurationStateMap;
  stateAt: (nodeId: string) => CurationState;
  setState: (nodeId: string, next: CurationState) => void;
  cycleState: (nodeId: string) => void;
  reset: () => void;
  rollup: CurationRollup;
  /** Tokens that would be sent if the current curation were applied. */
  curatedTokens: number;
}

const STORAGE_PREFIX = "contextual.curation.v1.";
const ENABLED_KEY = "contextual.curation.enabled.v1";

// Summarization is assumed to compress the content to roughly this fraction.
// Cheap, deterministic, easy to override later if we wire a real summarizer.
const SUMMARIZE_FRACTION = 0.2;

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

function readStates(sessionId: string): CurationStateMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as CurationStateMap) : {};
  } catch {
    return {};
  }
}

function writeStates(sessionId: string, states: CurationStateMap): void {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(states).length === 0) {
      window.localStorage.removeItem(storageKey(sessionId));
    } else {
      window.localStorage.setItem(storageKey(sessionId), JSON.stringify(states));
    }
  } catch {
    // ignore quota / disabled storage
  }
}

function readEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEnabled(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(ENABLED_KEY, "1");
    else window.localStorage.removeItem(ENABLED_KEY);
  } catch {
    // ignore
  }
}

const NEXT_STATE: Record<CurationState, CurationState> = {
  keep: "summarize",
  summarize: "drop",
  drop: "keep",
};

export interface UseCurationInput {
  sessionId: string;
  tree: ContextTreeNode | null;
}

export function useCuration({ sessionId, tree }: UseCurationInput): CurationApi {
  const [enabled, setEnabledState] = useState<boolean>(() => readEnabled());
  const [states, setStates] = useState<CurationStateMap>(() => readStates(sessionId));

  // Reload when session changes.
  useEffect(() => {
    setStates(readStates(sessionId));
  }, [sessionId]);

  // Persist state changes.
  useEffect(() => {
    writeStates(sessionId, states);
  }, [sessionId, states]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    writeEnabled(next);
  }, []);

  const stateAt = useCallback(
    (nodeId: string): CurationState => states[nodeId] ?? "keep",
    [states],
  );

  const setState = useCallback((nodeId: string, next: CurationState) => {
    setStates((current) => {
      if (next === "keep") {
        if (!(nodeId in current)) return current;
        const { [nodeId]: _drop, ...rest } = current;
        return rest;
      }
      if (current[nodeId] === next) return current;
      return { ...current, [nodeId]: next };
    });
  }, []);

  const cycleState = useCallback((nodeId: string) => {
    setStates((current) => {
      const now = current[nodeId] ?? "keep";
      const next = NEXT_STATE[now];
      if (next === "keep") {
        if (!(nodeId in current)) return current;
        const { [nodeId]: _drop, ...rest } = current;
        return rest;
      }
      return { ...current, [nodeId]: next };
    });
  }, []);

  const reset = useCallback(() => setStates({}), []);

  const rollup = useMemo<CurationRollup>(() => {
    if (!tree) return { raw: 0, kept: 0, summarized: 0, dropped: 0, delta: 0 };

    let raw = 0;
    let kept = 0;
    let summarized = 0;
    let dropped = 0;

    const flat = flattenContextTree(tree);
    for (const node of flat) {
      if (!isLeafContent(node)) continue;
      const tokens = node.tokens ?? 0;
      if (!tokens) continue;
      raw += tokens;
      const state = effectiveState(states, tree, node.id);
      if (state === "drop") dropped += tokens;
      else if (state === "summarize") {
        const compressed = Math.round(tokens * SUMMARIZE_FRACTION);
        summarized += tokens - compressed;
        kept += compressed;
      } else {
        kept += tokens;
      }
    }

    return {
      raw,
      kept,
      summarized,
      dropped,
      delta: raw - kept,
    };
  }, [tree, states]);

  return {
    enabled,
    setEnabled,
    states,
    stateAt,
    setState,
    cycleState,
    reset,
    rollup,
    curatedTokens: rollup.kept,
  };
}

/** Leaves whose tokens count toward the budget. Folders and overviews do not. */
function isLeafContent(node: ContextTreeNode): boolean {
  return node.kind === "atom" || node.kind === "block" || node.kind === "slice";
}

/**
 * Effective state for a node, walking up to find an ancestor with an explicit
 * state. Dropping a parent drops its descendants; summarizing a parent
 * summarizes its descendants — unless a descendant has its own explicit state
 * (own state wins).
 */
function effectiveState(
  states: CurationStateMap,
  tree: ContextTreeNode,
  nodeId: string,
): CurationState {
  const ancestors = ancestorPath(tree, nodeId);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    const explicit = states[ancestor.id];
    if (explicit) return explicit;
  }
  return "keep";
}

function ancestorPath(root: ContextTreeNode, targetId: string): ContextTreeNode[] {
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

export const CURATION_SYMBOL: Record<CurationState, string> = {
  keep: "·",
  summarize: "≈",
  drop: "✕",
};

export const CURATION_LABEL: Record<CurationState, string> = {
  keep: "keep",
  summarize: "summarize",
  drop: "drop",
};
