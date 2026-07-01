"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, Flag, Keyboard, Moon, Sun } from "lucide-react";
import { useTheme } from "hudsonkit";
import { useContextualApp } from "@/contextualApp/ContextualProvider";
import { useContextualFlag } from "@/contextualApp/flags";

/**
 * Light/dark toggle. Drives HudsonKit's ThemeProvider (persisted to
 * contextual.theme); the pre-paint theme script applies the stored choice
 * before first paint, so flipping here has no flash. resolvedTheme is
 * undefined during SSR / first client render — we render a neutral icon
 * until it settles to avoid a hydration mismatch. HeaderActions always renders
 * inside the app's ThemeProvider, so useTheme is safe here.
 */
function ThemeToggle() {
  const theme = useTheme();
  const resolved = theme.resolvedTheme;
  const isLight = resolved === "light";
  const next = isLight ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={() => theme.setTheme(next)}
      title={resolved ? `Switch to ${next} mode` : "Toggle theme"}
      aria-label={resolved ? `Switch to ${next} mode` : "Toggle theme"}
      className="flex items-center rounded-[2px] border border-[var(--hg-line)] px-1.5 py-1 transition-colors hover:border-[var(--hg-accent)] hover:text-[var(--hg-ink)]"
    >
      {isLight ? <Moon size={12} /> : <Sun size={12} />}
    </button>
  );
}

/**
 * Consolidated right-side header cluster:
 *   - active feature-flag indicator (names the enabled, non-default surfaces;
 *     click to open the Feature Flags panel) — Scout-style status surfacing
 *   - keyboard shortcuts moved into a popover (off the always-on chrome)
 *   - runtime meta (thread count) only when the Instantiate surface is enabled
 */
export function HeaderActions() {
  const { store, setFlagsOpen, replayWalkthrough } = useContextualApp();
  const packageOn = useContextualFlag("surface.package");
  const instantiateOn = useContextualFlag("surface.instantiate");
  const forkOn = useContextualFlag("surface.fork");
  const treeOn = useContextualFlag("surface.tree");
  const filtersOn = useContextualFlag("explore.filters");

  const activeFlags = [
    instantiateOn && "Instantiate",
    packageOn && "Package",
    forkOn && "Fork",
    treeOn && "Tree",
    filtersOn && "Filters",
  ].filter(Boolean) as string[];

  const shortcuts: { keys: string; label: string }[] = [
    { keys: "⌘K", label: "Command palette" },
    { keys: "J / K", label: "Next / prev session" },
    ...(forkOn ? [{ keys: "⌘B", label: "Fork run" }] : []),
    ...(treeOn ? [{ keys: "⌘T", label: "Fork tree" }] : []),
    ...(instantiateOn ? [{ keys: "⌘↵", label: "Dispatch" }] : []),
  ];

  const [hintsOpen, setHintsOpen] = useState(false);
  const hintsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hintsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!hintsRef.current?.contains(e.target as Node)) setHintsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [hintsOpen]);

  return (
    <div className="flex items-center gap-2.5 hg-mono text-[10.5px] text-[var(--hg-muted)]">
      <ThemeToggle />

      <button
        type="button"
        onClick={() => setFlagsOpen(true)}
        title="Feature flags — graduate capabilities on/off"
        className="flex items-center gap-1.5 rounded-[2px] border border-[var(--hg-line)] px-1.5 py-1 transition-colors hover:border-[var(--hg-accent)] hover:text-[var(--hg-ink)]"
      >
        <Flag size={11} />
        {activeFlags.length ? (
          <span className="text-[var(--hg-ink)]">{activeFlags.join(" · ")}</span>
        ) : (
          <span>flags</span>
        )}
      </button>

      <div className="relative" ref={hintsRef}>
        <button
          type="button"
          onClick={() => setHintsOpen((o) => !o)}
          title="Keyboard shortcuts"
          aria-label="Keyboard shortcuts"
          className="flex items-center rounded-[2px] border border-[var(--hg-line)] px-1.5 py-1 transition-colors hover:text-[var(--hg-ink)]"
        >
          <Keyboard size={12} />
        </button>
        {hintsOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[220px] rounded-[4px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-2.5 shadow-[var(--ctx-pop-shadow)]">
            <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-[var(--hg-muted)]">
              Shortcuts
            </p>
            <div className="flex flex-col gap-1">
              {shortcuts.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3">
                  <span className="text-[10.5px] text-[var(--hg-ink)]">{s.label}</span>
                  <span className="hg-kbd">{s.keys}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setHintsOpen(false);
                replayWalkthrough();
              }}
              className="mt-2.5 flex w-full items-center gap-1.5 rounded-[3px] border border-[var(--hg-line)] px-2 py-1.5 text-[10.5px] text-[var(--hg-ink-2)] transition-colors hover:border-[var(--hg-accent)] hover:text-[var(--hg-ink)]"
            >
              <Compass size={12} className="text-[var(--hg-accent)]" />
              Replay walkthrough
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={replayWalkthrough}
        title="Replay the guided Explore walkthrough"
        aria-label="Replay walkthrough"
        className="flex items-center rounded-[2px] border border-[var(--hg-line)] px-1.5 py-1 transition-colors hover:border-[var(--hg-accent)] hover:text-[var(--hg-ink)]"
      >
        <Compass size={12} />
      </button>

      {instantiateOn && (
        <span className="text-[var(--hg-ink)]">
          <b className="font-medium">{store.threads.length}</b>{" "}
          <span className="text-[var(--hg-muted)]">threads</span>
        </span>
      )}
    </div>
  );
}
