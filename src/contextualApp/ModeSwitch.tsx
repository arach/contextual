"use client";

import type { AppMode } from "@/contextualApp/modes";
import { APP_MODES } from "@/contextualApp/modes";
import { useContextualFlag } from "@/contextualApp/flags";

interface ModeSwitchProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  const packageOn = useContextualFlag("surface.package");
  const instantiateOn = useContextualFlag("surface.instantiate");

  const modes = APP_MODES.filter(
    ({ id }) =>
      id === "analysis" ||
      (id === "designer" && packageOn) ||
      (id === "session" && instantiateOn),
  );

  // With only Explore enabled there's nothing to switch between — keep the
  // header clean and drop the lone tab.
  if (modes.length <= 1) return null;

  return (
    <div className="ctx-nav-tabs" role="tablist" aria-label="Contextual mode">
      {modes.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={"ctx-nav-tab" + (mode === id ? " active" : "")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
