"use client";

import { useMemo } from "react";
import { createElement } from "react";
import { Layers, Radio, SlidersHorizontal } from "lucide-react";
import type { CommandOption, HudsonApp, StatusColor, TakeoverState } from "hudsonkit";
import { ContextualProvider, useContextualApp } from "@/contextualApp/ContextualProvider";
import { useContextualFlag } from "@/contextualApp/flags";
import { ContextualNavActions, ContextualNavCenter } from "@/contextualApp/NavCenter";
import { AppContent } from "@/contextualApp/slots/AppContent";
import { AppLeftPanel } from "@/contextualApp/slots/AppLeftPanel";
import { AppInspector } from "@/contextualApp/slots/AppInspector";
import { SessionReplaySurface } from "@/components/analysis/SessionReplaySurface";
import { buildManifest } from "@/lib/derive";
import { adjacentSessionId, exploreSessionNavIds } from "@/lib/exploreNavOrder";
import { loadPhaseColor, loadPhaseLabel } from "@/lib/sessionLoadPhase";
import { useCommands as useThreadCommands } from "@/state/useCommands";

function useCommands(): CommandOption[] {
  const app = useContextualApp();
  const packageOn = useContextualFlag("surface.package");
  const instantiateOn = useContextualFlag("surface.instantiate");
  const forkOn = useContextualFlag("surface.fork");
  const treeOn = useContextualFlag("surface.tree");
  // Panel toggles come from Hudson AppShell shellCommands — do not duplicate ids.
  const shellCommands = useThreadCommands(app.store, {
    openDesigner: () => app.setMode("designer"),
    openSession: () => app.setMode("session"),
    openAnalysis: () => app.setMode("analysis"),
    openTree: () => app.setTreeOpen(true),
  });

  return useMemo(() => {
    const modeCommands: CommandOption[] = [
      { id: "contextual:mode-work", label: "Instantiate", action: () => app.setMode("session") },
      { id: "contextual:mode-explore", label: "Explore", action: () => app.setMode("analysis") },
      { id: "contextual:mode-packages", label: "Package", action: () => app.setMode("designer") },
      { id: "contextual:feature-flags", label: "Feature Flags", action: () => app.setFlagsOpen(true) },
    ];

    if (app.mode === "analysis") {
      modeCommands.push(
        {
          id: "contextual:explore-next-session",
          label: "Next explore session",
          shortcut: "J",
          action: () => {
            const ids = exploreSessionNavIds(app.explore.catalogEntries, app.explore.pinnedPaths);
            const next = adjacentSessionId(ids, app.explore.activeId, 1);
            if (next) app.explore.setActiveId(next);
          },
        },
        {
          id: "contextual:explore-prev-session",
          label: "Previous explore session",
          shortcut: "K",
          action: () => {
            const ids = exploreSessionNavIds(app.explore.catalogEntries, app.explore.pinnedPaths);
            const prev = adjacentSessionId(ids, app.explore.activeId, -1);
            if (prev) app.explore.setActiveId(prev);
          },
        },
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

    // Hide commands whose surface is flagged off. Runtime-only commands
    // (run switching, rack pins) ride along with the Instantiate flag.
    const enabled = (id: string): boolean => {
      if (id === "contextual:mode-work" || id === "shell:open-session") return instantiateOn;
      if (id === "contextual:mode-packages" || id === "shell:open-designer") return packageOn;
      if (id === "shell:open-tree") return treeOn;
      if (id === "thread:branch") return forkOn;
      if (id.startsWith("thread:") || id.startsWith("rack:")) return instantiateOn;
      return true;
    };

    return [...modeCommands, ...shellCommands].filter((cmd) => enabled(cmd.id));
  }, [app, shellCommands, packageOn, instantiateOn, forkOn, treeOn]);
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
    return { label: `package · ${designer.active.name}`, color: "neutral" };
  }

  const phaseLabel = loadPhaseLabel(explore.loadPhase);
  if (phaseLabel) {
    return { label: phaseLabel, color: loadPhaseColor(explore.loadPhase) };
  }
  if (explore.error) return { label: "session error", color: "red" };
  const session = explore.active;
  if (!session) return { label: "no session selected", color: "amber" };
  return { label: `${session.project} · ${session.title}`, color: "emerald" };
}

/**
 * Drives the shell's Takeover slot: the full-bleed Session Replay surface mounts
 * (above the shell chrome, background inert) only when `replaySessionId` resolves
 * to a loaded session. `dismissible` wires the shell's built-in Escape + focus
 * handling to `closeReplay`, which also clears the ?replay= param.
 */
function useTakeover(): TakeoverState {
  const { replaySessionId, explore, closeReplay } = useContextualApp();
  const active =
    replaySessionId !== null &&
    explore.sessions.some((session) => session.id === replaySessionId);
  return useMemo(
    () => ({ active, dismissible: true, onDismiss: closeReplay }),
    [active, closeReplay],
  );
}

export const contextualApp: HudsonApp = {
  id: "contextual",
  name: "Contextual",
  description: "Upstream context tooling for exploring, packaging, instantiating, and forking agent sessions",
  mode: "panel",
  icon: createElement(Layers, { size: 14 }),
  agentContext:
    "Contextual prepares agent sessions before launch and fork. Harness records are preserved as source truth; Contextual atoms, buckets, and packages are interpretation layers with provenance.",

  leftPanel: { title: "Runs", icon: createElement(Radio, { size: 12 }) },
  rightPanel: { title: "Inspector", icon: createElement(SlidersHorizontal, { size: 12 }) },

  Provider: ContextualProvider,

  slots: {
    Content: AppContent,
    LeftPanel: AppLeftPanel,
    Inspector: AppInspector,
    Takeover: SessionReplaySurface,
  },

  hooks: {
    useCommands,
    useStatus,
    useTakeover,
    useNavCenter: () => <ContextualNavCenter />,
    useNavActions: () => <ContextualNavActions />,
  },
};
