"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, GitFork, Layers, Package, Rocket, Telescope } from "lucide-react";
import type { AppMode } from "@/contextualApp/modes";
import { useContextualApp } from "@/contextualApp/ContextualProvider";
import { useContextualFlag } from "@/contextualApp/flags";

interface Verb {
  mode: AppMode;
  name: string;
  desc: string;
  icon: typeof Telescope;
}

const VERBS: Verb[] = [
  {
    mode: "analysis",
    name: "Explore",
    desc: "Inspect prior agent sessions — atoms, buckets, and stale context.",
    icon: Telescope,
  },
  {
    mode: "designer",
    name: "Package",
    desc: "Distill reusable context into versioned artifacts with provenance.",
    icon: Package,
  },
  {
    mode: "session",
    name: "Instantiate",
    desc: "Compile a package into a launch plan for a target harness.",
    icon: Rocket,
  },
  {
    mode: "session",
    name: "Fork",
    desc: "Derive a new run from a prior manifest, with explicit lineage.",
    icon: GitFork,
  },
];

export function WelcomeOverlay() {
  const { onboarded, setOnboarded, demoForced, setDemo, setMode } = useContextualApp();
  const packageOn = useContextualFlag("surface.package");
  const instantiateOn = useContextualFlag("surface.instantiate");
  const forkOn = useContextualFlag("surface.fork");
  const [mounted, setMounted] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Only pitch the verbs whose surfaces are actually enabled. In the basics
  // starter set this collapses to Explore, keeping onboarding honest.
  const verbs = VERBS.filter(
    (verb) =>
      verb.name === "Explore" ||
      (verb.name === "Package" && packageOn) ||
      (verb.name === "Instantiate" && instantiateOn) ||
      (verb.name === "Fork" && forkOn),
  );

  // Gate on client mount so we read the persisted flag before painting (no flash for returning users).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || onboarded) return;
    primaryRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOnboarded(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onboarded, setOnboarded]);

  if (!mounted || onboarded) return null;

  function enter(mode: AppMode, withDemo: boolean) {
    if (withDemo) setDemo(true);
    setMode(mode);
    setOnboarded(true);
  }

  function startTour() {
    enter("analysis", true);
  }

  function useOwnData() {
    setDemo(false);
    setMode("analysis");
    setOnboarded(true);
  }

  return (
    <div
      className="ctx-welcome-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Contextual"
    >
      <div className="ctx-welcome-card">
        <div className="flex items-center gap-2.5">
          <span className="ctx-welcome-verb-icon" style={{ width: 26, height: 26 }}>
            <Layers size={14} />
          </span>
          <span className="ctx-welcome-eyebrow">Contextual</span>
        </div>

        <h1 className="ctx-welcome-title">Context engineering, before the run starts.</h1>
        <p className="ctx-welcome-lede">
          Contextual inspects your prior agent sessions, packages the durable context worth keeping,
          and instantiates new runs in a target harness — with provenance you can trust. Here is the
          loop:
        </p>

        <div className="ctx-welcome-verbs">
          {verbs.map((verb) => {
            const Icon = verb.icon;
            return (
              <button
                key={verb.name}
                type="button"
                className="ctx-welcome-verb"
                onClick={() => enter(verb.mode, true)}
              >
                <span className="ctx-welcome-verb-icon">
                  <Icon size={15} />
                </span>
                <span>
                  <span className="ctx-welcome-verb-name">{verb.name}</span>
                  <span className="ctx-welcome-verb-desc">{verb.desc}</span>
                </span>
                <ArrowRight className="ctx-welcome-verb-arrow" size={15} />
              </button>
            );
          })}
        </div>

        <div className="ctx-welcome-actions">
          <button ref={primaryRef} type="button" className="hg-btn primary" onClick={startTour}>
            Take the demo tour
          </button>
          {demoForced ? (
            <span className="hg-pill accent">Demo mode · CONTEXTUAL_DEMO=1</span>
          ) : (
            <button type="button" className="hg-btn ghost" onClick={useOwnData}>
              Use my own sessions
            </button>
          )}
        </div>

        <p className="ctx-welcome-footnote">
          {demoForced
            ? "Serving a curated demo corpus. Unset CONTEXTUAL_DEMO to read your own ~/.claude and ~/.codex sessions."
            : "The tour runs on a curated demo corpus — no setup, no keys. “Use my own sessions” reads ~/.claude and ~/.codex on this machine."}
        </p>
      </div>
    </div>
  );
}
