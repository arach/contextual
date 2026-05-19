"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePersistentState } from "hudsonkit";
import { useSessionAnalysisState } from "@/components/analysis/SessionAnalysis";
import type { ExploreAnalysisState } from "@/components/analysis/SessionAnalysis";
import { useDesignerState } from "@/components/designer/Designer";
import type { AppMode } from "@/contextualApp/modes";
import { buildManifest } from "@/lib/derive";
import { tokFor } from "@/lib/tokens";
import { dispatch as dispatchBackend, branch as branchBackend } from "@/lib/backends/client";
import { useThreadStore } from "@/state/useThreadStore";

export interface ContextualAppState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  explore: ExploreAnalysisState;
  designer: ReturnType<typeof useDesignerState>;
  store: ReturnType<typeof useThreadStore>;
  thinking: boolean;
  syncTick: number;
  dispatch: () => Promise<void>;
  branchAndFork: () => Promise<void>;
  treeOpen: boolean;
  setTreeOpen: (open: boolean) => void;
  inFlightTokens: number;
}

const ContextualContext = createContext<ContextualAppState | null>(null);

export function useContextualApp(): ContextualAppState {
  const ctx = useContext(ContextualContext);
  if (!ctx) throw new Error("useContextualApp must be used within ContextualProvider");
  return ctx;
}

/** @deprecated Use useContextualApp().explore */
export function useContextualExplore(): ExploreAnalysisState {
  return useContextualApp().explore;
}

export function ContextualProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = usePersistentState<AppMode>("contextual.mode", "analysis");
  const store = useThreadStore();
  const explore = useSessionAnalysisState();
  const designer = useDesignerState();
  const [thinking, setThinking] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const [treeOpen, setTreeOpen] = useState(false);
  const lastAnalysisSessionRef = useRef("");

  useEffect(() => {
    if (mode !== "analysis" || !explore.activeId) return;
    if (explore.activeId === lastAnalysisSessionRef.current) return;
    lastAnalysisSessionRef.current = explore.activeId;
  }, [mode, explore.activeId]);

  const manifest = useMemo(() => buildManifest(store.active), [store.active]);
  const composerTokens = tokFor(store.active.composer);
  const inFlightTokens = manifest.total + composerTokens;

  const dispatch = useCallback(async () => {
    const threadAtDispatch = store.active;
    const text = store.sendUserMessage();
    if (!text) return;
    setThinking(true);
    try {
      const result = await dispatchBackend(threadAtDispatch, text);
      store.appendModelReply(result.reply);
      if (result.usage) {
        store.setLastUsage({
          costUsd: result.usage.cost.total,
          cacheRead: result.usage.cacheRead,
          input: result.usage.input,
          output: result.usage.output,
        });
      }
      setSyncTick((t) => t + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      store.appendModelReply(`(backend unavailable — ${msg})`);
    } finally {
      setThinking(false);
    }
  }, [store]);

  const branchAndFork = useCallback(async () => {
    const threadAtBranch = store.active;
    const fromBranch = threadAtBranch.activeBranch;
    store.branch();
    const newBranch = `branch-${store.active.branches.length}`;
    try {
      await branchBackend(threadAtBranch, fromBranch, newBranch);
    } catch (e) {
      console.warn("branch backend failed:", e);
    }
  }, [store]);

  const value = useMemo<ContextualAppState>(
    () => ({
      mode,
      setMode,
      explore,
      designer,
      store,
      thinking,
      syncTick,
      dispatch,
      branchAndFork,
      treeOpen,
      setTreeOpen,
      inFlightTokens,
    }),
    [
      mode,
      setMode,
      explore,
      designer,
      store,
      thinking,
      syncTick,
      dispatch,
      branchAndFork,
      treeOpen,
      inFlightTokens,
    ],
  );

  return <ContextualContext.Provider value={value}>{children}</ContextualContext.Provider>;
}
