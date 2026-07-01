"use client";

import { FeatureFlagPanel } from "hudsonkit/flags";

import { SessionAnalysisWorkbench } from "@/components/analysis/SessionAnalysis";
import { ExploreEmptyState } from "@/components/analysis/ExploreEmptyState";
import { ConversationArea } from "@/components/ConversationArea";
import { DesignerWorkbench } from "@/components/designer/Designer";
import { SessionTree } from "@/components/tree/SessionTree";
import { useContextualApp } from "@/contextualApp/ContextualProvider";
import { useContextualFlag } from "@/contextualApp/flags";
import { WelcomeOverlay } from "@/contextualApp/WelcomeOverlay";
import { ExploreWalkthrough } from "@/contextualApp/ExploreWalkthrough";
import { useExploreKeyboardNav } from "@/hooks/useExploreKeyboardNav";

export function AppContent() {
  const {
    mode,
    explore,
    designer,
    store,
    thinking,
    inFlightTokens,
    dispatch,
    createDesignedSession,
    openReplay,
    treeOpen,
    setTreeOpen,
    flagsOpen,
    setFlagsOpen,
    demoForced,
    setDemo,
  } = useContextualApp();
  const treeOn = useContextualFlag("surface.tree");

  useExploreKeyboardNav(explore, mode === "analysis");

  // Explore has settled (not loading, no error) but found nothing to show.
  const exploreEmpty =
    !explore.loading && !explore.error && explore.catalogEntries.length === 0;

  return (
    <>
      <WelcomeOverlay />
      <ExploreWalkthrough />
      <FeatureFlagPanel isOpen={flagsOpen} onClose={() => setFlagsOpen(false)} />
      {treeOn && <SessionTree isOpen={treeOpen} onClose={() => setTreeOpen(false)} />}
      <div className="flex h-full min-h-0 flex-col">
        {mode === "session" ? (
          <ConversationArea
            thread={store.active}
            thinking={thinking}
            inFlightTokens={inFlightTokens}
            onComposerChange={store.setComposer}
            onDispatch={dispatch}
          />
        ) : mode === "designer" ? (
          <DesignerWorkbench
            state={designer}
            onCreateSession={createDesignedSession}
          />
        ) : exploreEmpty ? (
          <ExploreEmptyState
            demoForced={demoForced}
            onStartDemo={() => setDemo(true)}
            onRescan={() => window.location.reload()}
            onImportPath={explore.importByPath}
          />
        ) : (
          <SessionAnalysisWorkbench
            state={explore}
            showContextConsole={false}
            onOpenTree={treeOn ? () => setTreeOpen(true) : undefined}
            onReplaySession={openReplay}
          />
        )}
      </div>
    </>
  );
}
