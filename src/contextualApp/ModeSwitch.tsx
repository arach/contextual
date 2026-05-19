"use client";

import type { AppMode } from "@/contextualApp/modes";
import { APP_MODES } from "@/contextualApp/modes";

interface ModeSwitchProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div className="ctx-nav-tabs" role="tablist" aria-label="Contextual mode">
      {APP_MODES.map(({ id, label }) => (
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
