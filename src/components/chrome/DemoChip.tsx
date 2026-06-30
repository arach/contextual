"use client";

import { useEffect, useRef, useState } from "react";
import { useContextualApp } from "@/contextualApp/ContextualProvider";

/**
 * Chrome indicator shown while the app is serving the curated demo corpus. When demo
 * is a user choice (not env-forced) it doubles as the exit: a small popover offers to
 * switch to the user's own ~/.claude / ~/.codex sessions.
 */
export function DemoChip() {
  const { demo, demoForced, setDemo, setOnboarded, setMode } = useContextualApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!demo) return null;

  const chipClass =
    "hg-mono text-[10px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-[2px] " +
    "border border-[var(--ctx-accent-line)] bg-[var(--ctx-accent-tint)] text-[var(--ctx-accent)] " +
    "flex items-center gap-1.5 transition-colors";

  const dot = (
    <span className="w-[5px] h-[5px] rounded-full bg-[var(--ctx-accent)] shadow-[0_0_6px_var(--ctx-accent)]" />
  );

  if (demoForced) {
    return (
      <span className={chipClass} title="Demo corpus forced via CONTEXTUAL_DEMO=1">
        {dot}
        Demo
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={chipClass + " hover:bg-[color-mix(in_srgb,var(--ctx-accent)_22%,transparent)]"}
        title="Exploring a curated demo corpus — click for options"
      >
        {dot}
        Demo
        <span className="text-[var(--ctx-accent-deep)]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[260px] bg-[var(--ctx-surface)] border border-[var(--ctx-line)] rounded-[4px] shadow-[var(--ctx-pop-shadow)] p-3">
          <p className="text-[11.5px] leading-relaxed text-[var(--ctx-ink-3)]">
            You&rsquo;re exploring a curated demo corpus — no setup or keys required. Switch to your
            own sessions any time.
          </p>
          <button
            type="button"
            className="hg-btn primary mt-3 w-full justify-center"
            onClick={() => {
              setDemo(false);
              setMode("analysis");
              setOnboarded(true);
              setOpen(false);
            }}
          >
            Use my own sessions
          </button>
          <p className="hg-mono mt-2 text-[9px] leading-relaxed text-[var(--ctx-dim)]">
            Reads ~/.claude &amp; ~/.codex on this machine.
          </p>
        </div>
      )}
    </div>
  );
}
