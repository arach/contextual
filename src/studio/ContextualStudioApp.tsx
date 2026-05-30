"use client";

import { createElement, type ReactNode } from "react";
import { Compass, Layers, SearchCode } from "lucide-react";
import { StudioHudsonApp } from "studio/app-shell";
import { NextRouterProvider } from "studio/router/next";

import { CONTEXTUAL_THEME_DEFAULTS } from "@/contextualApp/themeConfig";
import {
  BUCKETS,
  HOME_HREF,
  STATUS_COLORS,
  presentationForHref,
  registry,
  statusPalette,
  studyForHref,
} from "@/studio/studioRegistry";
import {
  NorthStarPage,
  NotFoundPage,
  PresentationPage,
  StudyPage,
} from "@/studio/StudioPages";

function renderStudioPage({ pathname }: { pathname: string }): ReactNode {
  const presentation = presentationForHref(pathname);
  const study = studyForHref(pathname);

  if (pathname === HOME_HREF) {
    return <NorthStarPage />;
  }
  if (presentation) return <PresentationPage presentation={presentation} />;
  if (study) return <StudyPage study={study} />;
  return <NotFoundPage />;
}

const studioCommands = [
  {
    id: "contextual-studio:north-star",
    label: "Open North Star",
    action: () => window.location.assign(HOME_HREF),
  },
  {
    id: "contextual-studio:app",
    label: "Open Contextual App",
    action: () => window.location.assign("/"),
  },
];

export function ContextualStudioApp() {
  return (
    <StudioHudsonApp
      app={{
        id: "contextual-studio",
        name: "Contextual Studio",
        description:
          "Engineering vision, numbered CTH presentations, and Contextual design studies.",
        icon: createElement(Layers, { size: 14 }),
        agentContext:
          "Contextual Studio is the planning surface for upstream context tooling. Treat CTH pages as engineering presentations and studies as design explorations.",
        leftPanel: {
          title: "Studio",
          icon: createElement(Compass, { size: 12 }),
        },
      }}
      registry={registry}
      buckets={BUCKETS}
      statusColors={STATUS_COLORS}
      renderStatusPill={(status) => statusPalette.StatusPill({ status })}
      renderPage={renderStudioPage}
      homeHref={HOME_HREF}
      commands={studioCommands}
      status={{ label: "CTH presentations", color: "emerald" }}
      navCenter={
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
          <SearchCode size={13} />
          upstream context tooling
        </div>
      }
      routerProvider={NextRouterProvider}
      theme={CONTEXTUAL_THEME_DEFAULTS}
      managedTheme={false}
      chrome={{
        palette: true,
        terminal: false,
        rightPanel: false,
      }}
    />
  );
}
