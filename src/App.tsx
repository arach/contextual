// Top-level composition for Contextual. Uses Hudson's Frame in panel mode so
// the three columns sit as a static layout (no pan/zoom), then layers
// Hangar-specific chrome on top:
//   - ClassificationBand (the orange sliver)
//   - NavigationBar (top)
//   - SidePanel left (threads)
//   - SidePanel right (context rack)
//   - StatusBar (bottom)
//   - Center column with conversation + composer
//
// All thread state lives in useThreadStore; the LLM call is a no-op stub
// here since this prototype doesn't ship with a real backend.

import { useCallback, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Frame } from "hudsonkit/chrome";
import { usePersistentState } from "hudsonkit";

import { useThreadStore } from "@/state/useThreadStore";
import { useCommands } from "@/state/useCommands";
import { buildManifest } from "@/lib/derive";
import { tokFor } from "@/lib/tokens";
import { dispatch as dispatchBackend, branch as branchBackend } from "@/lib/backends/client";

import { ClassificationBand } from "@/components/chrome/ClassificationBand";
import { CommandPaletteHost } from "@/components/chrome/CommandPaletteHost";
import { TopBar } from "@/components/chrome/TopBar";
import { BottomStatusBar } from "@/components/chrome/BottomStatusBar";
import { ThreadsPanel } from "@/components/threads/ThreadsPanel";
import { ContextRack } from "@/components/rack/ContextRack";
import { ConversationArea } from "@/components/ConversationArea";
import { DesignerChrome, DesignerWorkbench, useDesignerState } from "@/components/designer/Designer";
import { SessionTree } from "@/components/tree/SessionTree";

// Default + clamp bounds for the resizable side panels. The center column
// reads the live width back through inset on every render, so dragging the
// resizer reflows the conversation in real time.
const LEFT_DEFAULT = 240;
const RIGHT_DEFAULT = 440;
const LEFT_MIN = 200;
const LEFT_MAX = 360;
const RIGHT_MIN = 320;
const RIGHT_MAX = 720;
const PANEL_W_COLLAPSED = 60;

export type AppMode = "session" | "designer";

export function App() {
  const store = useThreadStore();
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState<AppMode>("session");
  const [treeOpen, setTreeOpen] = useState(false);
  // Bumped after every dispatch so the workspace badge refetches.
  const [syncTick, setSyncTick] = useState(0);
  const [leftCollapsed, setLeftCollapsed] = usePersistentState("ctx.leftCollapsed", false);
  const [rightCollapsed, setRightCollapsed] = usePersistentState("ctx.rightCollapsed", false);
  const [leftWidth, setLeftWidth] = usePersistentState("ctx.leftWidth", LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = usePersistentState("ctx.rightWidth", RIGHT_DEFAULT);

  // Refs avoid stale closures when the mousemove handler reads the start
  // values; using refs is simpler than re-binding the handler on every width
  // change. Mirrors Hudson's own ResizableShell implementation.
  const dragRef = useRef<{ side: "left" | "right"; startX: number; startW: number } | null>(null);

  const onResize = useCallback(
    (side: "left" | "right") => (e: ReactMouseEvent) => {
      e.preventDefault();
      const startW = side === "left" ? leftWidth : rightWidth;
      dragRef.current = { side, startX: e.clientX, startW };
      const dir = side === "left" ? 1 : -1;
      const min = side === "left" ? LEFT_MIN : RIGHT_MIN;
      const max = side === "left" ? LEFT_MAX : RIGHT_MAX;
      const setter = side === "left" ? setLeftWidth : setRightWidth;
      const move = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = (ev.clientX - dragRef.current.startX) * dir;
        const next = Math.max(min, Math.min(max, dragRef.current.startW + delta));
        setter(next);
      };
      const up = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    },
    [leftWidth, rightWidth, setLeftWidth, setRightWidth],
  );

  const liveLeftW = leftCollapsed ? PANEL_W_COLLAPSED : leftWidth;
  const liveRightW = rightCollapsed ? PANEL_W_COLLAPSED : rightWidth;

  const commands = useCommands(store, {
    toggleLeft: () => setLeftCollapsed((c) => !c),
    toggleRight: () => setRightCollapsed((c) => !c),
    openDesigner: () => setMode("designer"),
    openSession: () => setMode("session"),
    openTree: () => setTreeOpen(true),
  });

  // Designer state is owned at this level so both DesignerChrome (in the HUD
  // slot) and DesignerWorkbench (in the center column) see the same package.
  const designer = useDesignerState();

  const manifest = useMemo(() => buildManifest(store.active), [store.active]);
  const composerTokens = tokFor(store.active.composer);
  const callTokens = manifest.total + composerTokens;

  const dispatch = useCallback(async () => {
    // Snapshot the active thread BEFORE we mutate it — we want to send the
    // model the manifest as it stood when the user hit dispatch.
    const threadAtDispatch = store.active;
    const text = store.sendUserMessage();
    if (!text) return;
    setThinking(true);
    try {
      // The plugin materializes Fixed modules into the workspace and pi
      // discovers them from cwd, so the wire payload is just (thread, text).
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

  // When the user creates a branch, also tell pi to record a pending fork
  // from the current branch so the next dispatch on the new branch carries
  // the parent's history.
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

  return (
    <Frame
      mode="panel"
      panOffset={{ x: 0, y: 0 }}
      scale={1}
      onPan={() => {}}
      onZoom={() => {}}
      hud={
        <div className="hg-shell">
          <ClassificationBand />
          <div className="hg-grid-overlay" />
          <CommandPaletteHost commands={commands} />
          <SessionTree isOpen={treeOpen} onClose={() => setTreeOpen(false)} />
          <TopBar
            mode={mode}
            onModeChange={setMode}
            threadName={store.active.name}
            activeBranch={store.active.activeBranch}
            threadCount={store.threads.length}
            backendConfig={store.active.backendConfig}
            onBackendChange={store.setBackendConfig}
          />
          {mode === "session" ? (
            <>
              <ThreadsPanel
                threads={store.threads}
                activeId={store.activeId}
                totalTokens={manifest.total}
                width={leftWidth}
                onResizeStart={onResize("left")}
                isCollapsed={leftCollapsed}
                onToggleCollapse={() => setLeftCollapsed((c) => !c)}
                onSelect={store.select}
                onSelectBranch={store.setActiveBranch}
                onBranch={store.branch}
              />
              <ContextRack
                thread={store.active}
                width={rightWidth}
                syncTick={syncTick}
                onResizeStart={onResize("right")}
                isCollapsed={rightCollapsed}
                onToggleCollapse={() => setRightCollapsed((c) => !c)}
                onSetFixedBudget={store.setFixedBudget}
                onSetSoftKeep={store.setSoftKeep}
                onPin={store.pinSoft}
                onUnpin={store.unpinFixed}
                onDrop={store.drop}
              />
            </>
          ) : (
            <DesignerChrome
              state={designer}
              leftWidth={leftWidth}
              rightWidth={rightWidth}
              leftCollapsed={leftCollapsed}
              rightCollapsed={rightCollapsed}
              onToggleLeft={() => setLeftCollapsed((c) => !c)}
              onToggleRight={() => setRightCollapsed((c) => !c)}
              onResizeLeft={onResize("left")}
              onResizeRight={onResize("right")}
            />
          )}
          <BottomStatusBar
            threadId={store.active.id}
            branchName={store.active.activeBranch}
            turn={store.active.turn}
            fixedTokens={manifest.fixedTokens}
            softTokens={manifest.softTokens}
          />
        </div>
      }
    >
      {/* Center column sits inside the Frame's content area, between the two
          fixed SidePanels and below the NavigationBar. Insets follow the
          live SidePanel widths so the column reflows when panels collapse or
          when the resizer is dragged. */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          // nav 48 + classification 18 = 66 top, status bar 28 bottom.
          top: 66,
          bottom: 28,
          left: liveLeftW,
          right: liveRightW,
          // No transition while dragging — the visual lag fights the cursor.
          transition: dragRef.current ? undefined : "left 200ms, right 200ms",
        }}
      >
        {mode === "session" ? (
          <ConversationArea
            thread={store.active}
            thinking={thinking}
            inFlightTokens={callTokens}
            onComposerChange={store.setComposer}
            onDispatch={dispatch}
            onBranch={branchAndFork}
            onOpenTree={() => setTreeOpen(true)}
          />
        ) : (
          <DesignerWorkbench state={designer} />
        )}
      </div>
    </Frame>
  );
}
