import type { AppMode } from "@/App";

interface ModeSwitchProps {
  mode: AppMode;
  onChange: (m: AppMode) => void;
}

const MODES: { id: AppMode; label: string }[] = [
  { id: "session", label: "Work" },
  { id: "analysis", label: "Explore" },
  { id: "designer", label: "Packages" },
];

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div className="ctx-nav-tabs" role="tablist" aria-label="Contextual mode">
      {MODES.map(({ id, label }) => (
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
