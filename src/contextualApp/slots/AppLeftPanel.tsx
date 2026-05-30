"use client";

import { ExploreSessionList } from "@/components/analysis/SessionAnalysis";
import { PackageList } from "@/components/designer/PackageList";
import { ThreadsPanelContent } from "@/components/threads/ThreadsPanel";
import { PACKAGES } from "@/data/packages";
import { useContextualApp } from "@/contextualApp/ContextualProvider";

export function AppLeftPanel() {
  const { mode, explore, designer, store, branchAndFork } = useContextualApp();

  if (mode === "session") {
    return (
      <ThreadsPanelContent
        threads={store.threads}
        activeId={store.activeId}
        onSelect={store.select}
        onSelectBranch={store.setActiveBranch}
        onBranch={branchAndFork}
      />
    );
  }

  if (mode === "designer") {
    return (
      <PackageList
        packages={PACKAGES}
        activeId={designer.activeId}
        onSelect={designer.setActiveId}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ExploreSessionList state={explore} />
    </div>
  );
}
