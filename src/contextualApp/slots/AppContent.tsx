"use client";

import { SessionAnalysisWorkbench } from "@/components/analysis/SessionAnalysis";
import { ConversationArea } from "@/components/ConversationArea";
import { DesignerWorkbench } from "@/components/designer/Designer";
import { SessionTree } from "@/components/tree/SessionTree";
import { useContextualApp } from "@/contextualApp/ContextualProvider";
import { useExploreKeyboardNav } from "@/hooks/useExploreKeyboardNav";

export function AppContent() {
  const { mode, explore, designer, store, thinking, inFlightTokens, dispatch, treeOpen, setTreeOpen } =
    useContextualApp();

  useExploreKeyboardNav(explore, mode === "analysis");

  return (
    <>
      <SessionTree isOpen={treeOpen} onClose={() => setTreeOpen(false)} />
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
          <DesignerWorkbench state={designer} />
        ) : (
          <SessionAnalysisWorkbench
            state={explore}
            showContextConsole={false}
            onOpenTree={() => setTreeOpen(true)}
          />
        )}
      </div>
    </>
  );
}
