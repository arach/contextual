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
import { useDemoMode } from "@/contextualApp/useDemoMode";
import { useContextualFlag } from "@/contextualApp/flags";
import { useSessionAnalysisState } from "@/components/analysis/SessionAnalysis";
import type { ExploreAnalysisState } from "@/components/analysis/SessionAnalysis";
import { useDesignerState } from "@/components/designer/Designer";
import type { AppMode } from "@/contextualApp/modes";
import { AGENT_ASSISTED_CONTEXT_DRAFT } from "@/data/contextResourceRepository";
import { buildManifest } from "@/lib/derive";
import {
  buildDesignedSession,
  type AgentAssistedContextDraft,
} from "@/lib/contextCreation";
import { tokFor } from "@/lib/tokens";
import { dispatch as dispatchBackend, branch as branchBackend } from "@/lib/backends/client";
import { useThreadStore } from "@/state/useThreadStore";

export interface ContextualAppState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  /** Session id whose full-bleed Session Replay surface is open, or null. */
  replaySessionId: string | null;
  /** Open the full-bleed Session Replay surface for a session (URL: ?replay=id). */
  openReplay: (id: string) => void;
  /** Close the Session Replay surface, returning to Explore (clears ?replay=). */
  closeReplay: () => void;
  explore: ExploreAnalysisState;
  designer: ReturnType<typeof useDesignerState>;
  store: ReturnType<typeof useThreadStore>;
  thinking: boolean;
  syncTick: number;
  dispatch: () => Promise<void>;
  branchAndFork: () => Promise<void>;
  createDesignedSession: (draft?: AgentAssistedContextDraft) => void;
  treeOpen: boolean;
  setTreeOpen: (open: boolean) => void;
  flagsOpen: boolean;
  setFlagsOpen: (open: boolean) => void;
  inFlightTokens: number;
  demo: boolean;
  demoForced: boolean;
  setDemo: (on: boolean) => void;
  onboarded: boolean;
  setOnboarded: (value: boolean) => void;
  /** True once the guided Explore walkthrough has been seen or dismissed. */
  walkthroughDone: boolean;
  setWalkthroughDone: (value: boolean) => void;
  /** Bumped to re-open the walkthrough on demand (replay), even after it's done. */
  walkthroughReplayTick: number;
  replayWalkthrough: () => void;
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
  const { demo, demoForced, setDemo } = useDemoMode();
  const [onboarded, setOnboarded] = usePersistentState<boolean>("contextual.onboarded", false);
  const [walkthroughDone, setWalkthroughDone] = usePersistentState<boolean>(
    "contextual.walkthrough.done",
    false,
  );
  const [walkthroughReplayTick, setWalkthroughReplayTick] = useState(0);
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null);
  const initialReplayAppliedRef = useRef(false);
  const packageOn = useContextualFlag("surface.package");
  const instantiateOn = useContextualFlag("surface.instantiate");
  const store = useThreadStore();
  const explore = useSessionAnalysisState(demo);
  const designer = useDesignerState();
  const [thinking, setThinking] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const [treeOpen, setTreeOpen] = useState(false);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const initialModeAppliedRef = useRef(false);
  const lastAnalysisSessionRef = useRef("");

  // A mode is reachable only when its flag is on. Explore is always available.
  const modeEnabled = useCallback(
    (candidate: AppMode) =>
      candidate === "analysis" ||
      (candidate === "designer" && packageOn) ||
      (candidate === "session" && instantiateOn),
    [packageOn, instantiateOn],
  );

  useEffect(() => {
    if (initialModeAppliedRef.current) return;
    const requested = new URLSearchParams(window.location.search).get("mode");
    if (requested === "analysis" || requested === "designer" || requested === "session") {
      initialModeAppliedRef.current = true;
      const timeout = window.setTimeout(() => {
        if (modeEnabled(requested)) setMode(requested);
        const url = new URL(window.location.href);
        url.searchParams.delete("mode");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [setMode, modeEnabled]);

  // If the active mode's flag is turned off (or was persisted before the flag
  // existed), fall back to Explore so we never strand the user on a hidden surface.
  useEffect(() => {
    if (!modeEnabled(mode)) setMode("analysis");
  }, [mode, modeEnabled, setMode]);

  // Bootstrap the replay surface from ?replay=<sessionId> on first load, mirroring
  // the ?mode= literal-parse above. Unlike ?mode= we leave the param in place: it
  // reflects the open surface, and openReplay/closeReplay maintain it thereafter.
  useEffect(() => {
    if (initialReplayAppliedRef.current) return;
    initialReplayAppliedRef.current = true;
    const requested = new URLSearchParams(window.location.search).get("replay");
    if (requested) setReplaySessionId(requested);
  }, []);

  const openReplay = useCallback((id: string) => {
    setReplaySessionId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("replay", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const closeReplay = useCallback(() => {
    setReplaySessionId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("replay");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

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

  // Replaying the tour resets the persisted flag and bumps the tick so the
  // overlay re-mounts even when the user is already on Explore. It also routes
  // back to Explore + demo, since the walkthrough only narrates that surface.
  const replayWalkthrough = useCallback(() => {
    setWalkthroughDone(false);
    setMode("analysis");
    setWalkthroughReplayTick((t) => t + 1);
  }, [setMode, setWalkthroughDone]);

  const createDesignedSession = useCallback((draft = AGENT_ASSISTED_CONTEXT_DRAFT) => {
    store.createDesignedSession(
      buildDesignedSession(draft, {
        now: new Date().toISOString(),
        profileId: draft.testDrive.profileId,
      }),
    );
    setMode("session");
  }, [setMode, store]);

  const value = useMemo<ContextualAppState>(
    () => ({
      mode,
      setMode,
      replaySessionId,
      openReplay,
      closeReplay,
      explore,
      designer,
      store,
      thinking,
      syncTick,
      dispatch,
      branchAndFork,
      createDesignedSession,
      treeOpen,
      setTreeOpen,
      flagsOpen,
      setFlagsOpen,
      inFlightTokens,
      demo,
      demoForced,
      setDemo,
      onboarded,
      setOnboarded,
      walkthroughDone,
      setWalkthroughDone,
      walkthroughReplayTick,
      replayWalkthrough,
    }),
    [
      mode,
      setMode,
      replaySessionId,
      openReplay,
      closeReplay,
      explore,
      designer,
      store,
      thinking,
      syncTick,
      dispatch,
      branchAndFork,
      createDesignedSession,
      treeOpen,
      flagsOpen,
      inFlightTokens,
      demo,
      demoForced,
      setDemo,
      onboarded,
      setOnboarded,
      walkthroughDone,
      setWalkthroughDone,
      walkthroughReplayTick,
      replayWalkthrough,
    ],
  );

  return <ContextualContext.Provider value={value}>{children}</ContextualContext.Provider>;
}
