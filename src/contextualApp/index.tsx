"use client";

import { useMemo } from "react";
import { createElement } from "react";
import { Layers, Radio, SlidersHorizontal } from "lucide-react";
import type { CommandOption, HudsonApp, StatusColor } from "hudsonkit";
import { ContextualProvider, useContextualApp } from "@/contextualApp/ContextualProvider";
import { ContextualNavActions, ContextualNavCenter } from "@/contextualApp/NavCenter";
import { AppContent } from "@/contextualApp/slots/AppContent";
import { AppLeftPanel } from "@/contextualApp/slots/AppLeftPanel";
import { AppInspector } from "@/contextualApp/slots/AppInspector";
import { buildManifest } from "@/lib/derive";
import { useCommands as useThreadCommands } from "@/state/useCommands";

function useCommands(): CommandOption[] {
  const app = useContextualApp();
  // Panel toggles come from Hudson AppShell shellCommands — do not duplicate ids.
  const shellCommands = useThreadCommands(app.store, {
    openDesigner: () => app.setMode("designer"),
    openSession: () => app.setMode("session"),
    openAnalysis: () => app.setMode("analysis"),
    openTree: () => app.setTreeOpen(true),
  });

  return useMemo(() => {
    const modeCommands: CommandOption[] = [
      { id: "contextual:mode-work", label: "Work", action: () => app.setMode("session") },
      { id: "contextual:mode-explore", label: "Explore", action: () => app.setMode("analysis") },
      { id: "contextual:mode-packages", label: "Packages", action: () => app.setMode("designer") },
    ];

    if (app.mode === "analysis") {
      modeCommands.push(
        {
          id: "contextual:reload-sessions",
          label: "Reload Session Corpus",
          action: () => window.location.reload(),
        },
        {
          id: "contextual:focus-active-session",
          label: "Focus Active Explore Session",
          action: () => {
            if (app.explore.activeId) app.explore.setActiveId(app.explore.activeId);
          },
        },
      );
    }

    return [...modeCommands, ...shellCommands];
  }, [app, shellCommands]);
}

function useStatus(): { label: string; color: StatusColor } {
  const { mode, explore, store, designer } = useContextualApp();

  if (mode === "session") {
    const manifest = buildManifest(store.active);
    return {
      label: `${store.active.name} · ${store.active.activeBranch} · ${Math.round(manifest.total / 1000)}k tok`,
      color: "emerald",
    };
  }

  if (mode === "designer") {
    return { label: `packages · ${designer.active.name}`, color: "neutral" };
  }

  if (explore.loading) return { label: "loading sessions", color: "amber" };
  if (explore.error) return { label: "session error", color: "red" };
  const session = explore.active;
  if (!session) return { label: "no session selected", color: "amber" };
  return { label: `${session.project} · ${session.title}`, color: "emerald" };
}

export const contextualApp: HudsonApp = {
  id: "contextual",
  name: "Contextual",
  description: "Context engineering — work, explore, and package agent context",
  mode: "panel",
  icon: createElement(Layers, { size: 14 }),
  agentContext:
    "Contextual inspects agent transcripts. Buckets and window packing are Contextual's proprietary model, not provider ground truth. Atoms are verbatim from source unless marked source-clipped.",

  leftPanel: { title: "Navigation", icon: createElement(Radio, { size: 12 }) },
  rightPanel: { title: "Inspector", icon: createElement(SlidersHorizontal, { size: 12 }) },

  Provider: ContextualProvider,

  slots: {
    Content: AppContent,
    LeftPanel: AppLeftPanel,
    Inspector: AppInspector,
  },

  hooks: {
    useCommands,
    useStatus,
    useNavCenter: () => <ContextualNavCenter />,
    useNavActions: () => <ContextualNavActions />,
  },
};
