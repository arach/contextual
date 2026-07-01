"use client";

import { ExploreAllocationInspector } from "@/components/analysis/SessionAnalysis";
import { PackageMeta } from "@/components/designer/PackageMeta";
import { ContextRackContent } from "@/components/rack/ContextRack";
import { useContextualApp } from "@/contextualApp/ContextualProvider";

export function AppInspector() {
  const { mode, explore, designer, store, syncTick } = useContextualApp();

  if (mode === "session") {
    return (
      <ContextRackContent
        thread={store.active}
        syncTick={syncTick}
        onSetFixedBudget={store.setFixedBudget}
        onSetSoftKeep={store.setSoftKeep}
        onPin={store.pinSoft}
        onUnpin={store.unpinFixed}
        onDrop={store.drop}
      />
    );
  }

  if (mode === "designer") {
    return <PackageMeta pkg={designer.active} modules={designer.modules} />;
  }

  return <ExploreAllocationInspector state={explore} />;
}
