// Pill toggle in the top bar. Session = chat-driven runtime; Designer = the
// workbench for crafting Fixed packages.

import type { AppMode } from "@/App";

interface ModeSwitchProps {
  mode: AppMode;
  onChange: (m: AppMode) => void;
}

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div className="inline-flex items-center gap-0 p-[2px] rounded-[2px] bg-[var(--hg-bg-tint)] border border-[var(--hg-line)]">
      {(["session", "designer"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={
            "hg-mono text-[10.5px] tracking-[0.12em] uppercase px-3 py-1 rounded-[2px] transition-colors " +
            (mode === m
              ? "bg-[var(--hg-accent)] text-[var(--hg-bg)]"
              : "bg-transparent text-[var(--hg-muted)] hover:text-[var(--hg-ink)]")
          }
        >
          {m}
        </button>
      ))}
    </div>
  );
}
