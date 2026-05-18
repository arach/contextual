// Embed-ready Hudson shell for Contextual v2. Standalone app and future Scout
// host both mount the same chrome: NavigationBar, side panels, status bar,
// center slot. No classification band or decorative grid.

import type { CSSProperties, ReactNode } from "react";
import { Frame } from "hudsonkit/chrome";

export const CONTEXTUAL_NAV_HEIGHT = 48;
export const CONTEXTUAL_STATUS_HEIGHT = 28;

export interface ContextualAppShellProps {
  /** When true, parent (e.g. OpenScout) owns outer nav; Contextual only fills center + side panels. */
  embedded?: boolean;
  leftInset: number;
  rightInset: number;
  centerTransition?: CSSProperties["transition"];
  chrome: ReactNode;
  children: ReactNode;
}

export function ContextualAppShell({
  embedded = false,
  leftInset,
  rightInset,
  centerTransition,
  chrome,
  children,
}: ContextualAppShellProps) {
  return (
    <Frame
      mode="panel"
      panOffset={{ x: 0, y: 0 }}
      scale={1}
      onPan={() => {}}
      onZoom={() => {}}
      hud={
        <div
          className="ctx-shell hg-shell"
          data-contextual-embedded={embedded ? "true" : undefined}
        >
          {chrome}
        </div>
      }
    >
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          top: embedded ? 0 : CONTEXTUAL_NAV_HEIGHT,
          bottom: embedded ? 0 : CONTEXTUAL_STATUS_HEIGHT,
          left: leftInset,
          right: rightInset,
          transition: centerTransition,
        }}
      >
        {children}
      </div>
    </Frame>
  );
}
