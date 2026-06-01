"use client";

import { createElement, useMemo, type ReactNode } from "react";
import { Compass, Layers, SearchCode } from "lucide-react";
import { StudioHudsonApp } from "studio/app-shell";
import { NextRouterProvider } from "studio/router/next";

import { CONTEXTUAL_THEME_DEFAULTS } from "@/contextualApp/themeConfig";
import {
  ContextDesignerPage,
  ContextTestDrivePage,
} from "@/studio/ContextDesignerPages";
import type { CtxDoc } from "@/studio/ctxDocs";
import {
  BUCKETS,
  CONTEXT_DESIGNER_HREF,
  HOME_HREF,
  STATUS_COLORS,
  CARTRIDGES_HREF,
  buildContextualRegistry,
  statusPalette,
  type ContextualRegistry,
} from "@/studio/studioRegistry";
import {
  NorthStarPage,
  NotFoundPage,
  CartridgePage,
  PresentationPage,
  StudyPage,
} from "@/studio/StudioPages";

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
  const presentation = ctx.presentationForHref(pathname);
  if (presentation) {
    const doc = docsById.get(presentation.id);
    if (!doc) return <NotFoundPage />;
    return <PresentationPage doc={doc} />;
  }
  const designerRoute = ctx.contextDesignerRouteForHref(pathname);
  if (designerRoute) {
    if (designerRoute.kind === "test-drive") {
      return <ContextTestDrivePage route={designerRoute} />;
    }
    return <ContextDesignerPage route={designerRoute} />;
  }
  const cartridgeRoute = ctx.cartridgeRouteForHref(pathname);
  if (cartridgeRoute) return <CartridgePage route={cartridgeRoute} />;
  const study = ctx.studyForHref(pathname);
  if (study) return <StudyPage study={study} />;
  return <NotFoundPage />;
}

const studioCommands = [
  {
    id: "contextual-studio:north-star",
    label: "Open Overview",
    action: () => window.location.assign(HOME_HREF),
  },
  {
    id: "contextual-studio:context-designer",
    label: "Open Context Lab",
    action: () => window.location.assign(CONTEXT_DESIGNER_HREF),
  },
  {
    id: "contextual-studio:cartridges",
    label: "Open Cartridges",
    action: () => window.location.assign(CARTRIDGES_HREF),
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
          "Design and test-drive context planning experiments before they graduate into the main app.",
        icon: createElement(Layers, { size: 14 }),
        agentContext:
          "Contextual Studio is the design and experimentation surface. The main app owns real session creation; Studio mirrors agent-assisted context drafts, CTX notes, and cartridge studies.",
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
