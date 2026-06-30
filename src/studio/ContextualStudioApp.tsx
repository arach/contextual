"use client";

import { createElement, useMemo, type ReactNode } from "react";
import { Compass, Layers, SearchCode } from "lucide-react";
import { StudioHudsonApp } from "studio/app-shell";
import { NextRouterProvider } from "studio/router/next";

import { CONTEXTUAL_THEME_DEFAULTS } from "@/contextualApp/themeConfig";
import type { CtxDoc } from "@/studio/ctxDocs";
import {
  BUCKETS,
  HOME_HREF,
  PACKAGE_VIEW_PROTOTYPE_HREF,
  STATUS_COLORS,
  buildContextualRegistry,
  statusPalette,
  type ContextualRegistry,
} from "@/studio/studioRegistry";
import {
  NorthStarPage,
  NotFoundPage,
  PresentationPage,
} from "@/studio/StudioPages";
import { PackageViewPrototype } from "@/studio/prototypes/PackageViewPrototype";

export interface ContextualStudioAppProps {
  ctxDocs?: CtxDoc[];
}

function renderStudioPage({
  pathname,
  ctx,
  docsById,
}: {
  pathname: string;
  ctx: ContextualRegistry;
  docsById: Map<string, CtxDoc>;
}): ReactNode {
  if (pathname === HOME_HREF) {
    return <NorthStarPage presentations={ctx.presentations} />;
  }
  if (pathname === PACKAGE_VIEW_PROTOTYPE_HREF) {
    return <PackageViewPrototype />;
  }
  const presentation = ctx.presentationForHref(pathname);
  if (presentation) {
    const doc = docsById.get(presentation.id);
    if (!doc) return <NotFoundPage />;
    return <PresentationPage doc={doc} />;
  }
  return <NotFoundPage />;
}

const studioCommands = [
  {
    id: "contextual-studio:overview",
    label: "Open Overview",
    action: () => window.location.assign(HOME_HREF),
  },
  {
    id: "contextual-studio:app",
    label: "Open Contextual App",
    action: () => window.location.assign("/"),
  },
];

export function ContextualStudioApp({
  ctxDocs = [],
}: ContextualStudioAppProps) {
  const ctx = useMemo(() => buildContextualRegistry(ctxDocs), [ctxDocs]);
  const docsById = useMemo(
    () => new Map(ctxDocs.map((d) => [d.id, d])),
    [ctxDocs],
  );

  return (
    <StudioHudsonApp
      app={{
        id: "contextual-studio",
        name: "Contextual Studio",
        description:
          "Overview and engineering notes for Contextual's context planning work.",
        icon: createElement(Layers, { size: 14 }),
        agentContext:
          "Contextual Studio surfaces the overview and engineering notes. The main app owns real session creation and the Designer workbench.",
        leftPanel: {
          title: "Studio",
          icon: createElement(Compass, { size: 12 }),
        },
      }}
      registry={ctx.registry}
      buckets={BUCKETS}
      statusColors={STATUS_COLORS}
      renderStatusPill={(status) => statusPalette.StatusPill({ status })}
      renderPage={({ pathname }) =>
        renderStudioPage({ pathname, ctx, docsById })
      }
      homeHref={HOME_HREF}
      commands={studioCommands}
      status={{ label: "studio", color: "emerald" }}
      navCenter={
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
          <SearchCode size={13} />
          context planning
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
