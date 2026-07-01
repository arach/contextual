"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Boxes,
  GitCompareArrows,
  Layers,
  ListTree,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useContextualApp } from "@/contextualApp/ContextualProvider";

/**
 * Guided Explore walkthrough — the layer *after* WelcomeOverlay. The welcome
 * modal explains the verbs and drops the user into Explore (demo); this tour
 * then narrates the actual on-screen anatomy by spotlighting real UI regions:
 *
 *   1. the Runs panel (a session = one agent transcript)
 *   2. the same panel's harness lanes (codex/claude/pi/grok — harness-neutral)
 *   3. the At-Rest | Contextual tabs (what was logged vs. what context is made of)
 *   4. the context tree (atoms classified into buckets)
 *   5. the Inspector (composition + threshold/window simulation)
 *
 * Steps anchor by CSS selector and re-measure on layout/scroll/resize so the
 * spotlight tracks its region. Dismissible (Esc / skip / backdrop), shown once
 * (contextual.walkthrough.done), and replayable from the header.
 */

type Placement = "right" | "left" | "bottom" | "top";

interface Step {
  id: string;
  /** Candidate anchors, tried in order; first one found in the DOM wins. */
  selectors: string[];
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Layers;
  placement: Placement;
}

const STEPS: Step[] = [
  {
    id: "sessions",
    selectors: ["#explore-panel-sessions"],
    eyebrow: "Runs",
    title: "Each row is one agent transcript",
    body: "A session is a single agent run — one harness driving one task down one path. This left rail lists them. The demo loads a curated corpus, so there's nothing to set up.",
    icon: Layers,
    placement: "right",
  },
  {
    id: "lanes",
    selectors: ["#explore-panel-sessions"],
    eyebrow: "Harness-neutral",
    title: "The same bug, four harnesses",
    body: "Four of these runs are the same “Binding Bug” fix driven through codex, claude, pi, and grok. Contextual captures and interprets each one uniformly — so you compare the work, not the log format.",
    icon: GitCompareArrows,
    placement: "right",
  },
  {
    id: "tabs",
    selectors: ['[aria-label="Explore context mode"]'],
    eyebrow: "Two readings",
    title: "At-Rest vs. Contextual",
    body: "At-Rest is the raw native records exactly as the harness wrote them to disk. Contextual is our neutral reading: every record becomes an atom, classified into a bucket. At-Rest = what was logged; Contextual = what the context is made of.",
    icon: GitCompareArrows,
    placement: "bottom",
  },
  {
    id: "tree",
    selectors: ["#explore-panel-tree"],
    eyebrow: "Atoms & buckets",
    title: "What the context is made of",
    body: "The Contextual tree groups every atom into a bucket — job, codebase, tools, verification, decisions, environment, policy, history. Click a node to read the underlying record in the editor.",
    icon: ListTree,
    placement: "right",
  },
  {
    id: "inspector",
    selectors: ["#explore-panel-inspector"],
    eyebrow: "Composition & window",
    title: "Which buckets dominate — and at what budget",
    body: "The Inspector shows the engine footprint and the bucket allocation: which buckets fill the window. The threshold control simulates the context window at different token budgets — pinned context stays, the tail truncates first.",
    icon: SlidersHorizontal,
    placement: "left",
  },
];

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(selectors: string[]): { rect: AnchorRect; el: Element } | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    return { rect: { top: r.top, left: r.left, width: r.width, height: r.height }, el };
  }
  return null;
}

const PAD = 6;
const CARD_W = 312;
const GAP = 14;

/** Clamp the tooltip card into the viewport for the chosen placement. */
function cardPosition(
  rect: AnchorRect,
  placement: Placement,
  vw: number,
  vh: number,
): { top: number; left: number } {
  const cardH = 220; // generous estimate; the card is height:auto, this only clamps
  let top: number;
  let left: number;

  switch (placement) {
    case "right":
      left = rect.left + rect.width + GAP;
      top = rect.top;
      break;
    case "left":
      left = rect.left - CARD_W - GAP;
      top = rect.top;
      break;
    case "bottom":
      left = rect.left + rect.width / 2 - CARD_W / 2;
      top = rect.top + rect.height + GAP;
      break;
    case "top":
    default:
      left = rect.left + rect.width / 2 - CARD_W / 2;
      top = rect.top - cardH - GAP;
      break;
  }

  left = Math.max(16, Math.min(left, vw - CARD_W - 16));
  top = Math.max(16, Math.min(top, vh - 120));
  return { top, left };
}

export function ExploreWalkthrough() {
  const { mode, demo, onboarded, walkthroughDone, setWalkthroughDone, walkthroughReplayTick } =
    useContextualApp();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex] ?? STEPS[0]!;

  // Open conditions: on Explore (demo), once onboarding's modal is closed and
  // the walkthrough hasn't been completed. Replays force-open via the tick.
  const eligible = mode === "analysis" && demo && onboarded && !walkthroughDone;

  useEffect(() => {
    if (eligible) {
      setStepIndex(0);
      setActive(true);
    }
  }, [eligible]);

  // Replay: re-open at step 0 regardless of the persisted flag (provider resets
  // it and routes to Explore). The tick guards against re-firing on every render.
  const lastReplayRef = useRef(walkthroughReplayTick);
  useEffect(() => {
    if (walkthroughReplayTick !== lastReplayRef.current) {
      lastReplayRef.current = walkthroughReplayTick;
      setStepIndex(0);
      setActive(true);
    }
  }, [walkthroughReplayTick]);

  const finish = useCallback(() => {
    setActive(false);
    setWalkthroughDone(true);
  }, [setWalkthroughDone]);

  const next = useCallback(() => {
    if (stepIndex >= STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }, [stepIndex, finish]);

  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  // Reset the anchor when the step changes so a stale rect from the previous
  // step never bleeds into the new one before the first measure lands.
  useLayoutEffect(() => {
    setAnchor(null);
  }, [stepIndex]);

  // Track the active anchor: re-measure on step change, resize, and scroll.
  // Once an anchor is found we keep the last good rect through transient
  // misses (a re-render can briefly drop the element mid-measure), so the
  // spotlight stays put instead of flickering to center.
  useLayoutEffect(() => {
    if (!active) return;
    let raf = 0;
    const sync = () => {
      const found = measure(step.selectors);
      if (found) setAnchor(found.rect);
      setVp({ w: window.innerWidth, h: window.innerHeight });
    };
    const onFrame = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("resize", onFrame);
    window.addEventListener("scroll", onFrame, true);
    // Anchors can mount a tick after the session corpus loads; poll briefly.
    const settle = window.setInterval(sync, 350);
    const stopSettle = window.setTimeout(() => window.clearInterval(settle), 2500);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onFrame);
      window.removeEventListener("scroll", onFrame, true);
      window.clearInterval(settle);
      window.clearTimeout(stopSettle);
    };
  }, [active, step]);

  // Keyboard: Esc skips, ←/→ navigate.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish, next, prev]);

  const cardPos = useMemo(() => {
    if (!anchor) return { top: vp.h / 2 - 110, left: vp.w / 2 - CARD_W / 2 };
    return cardPosition(anchor, step.placement, vp.w, vp.h);
  }, [anchor, step.placement, vp]);

  if (!active) return null;

  const Icon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;
  const spotlight = anchor
    ? {
        top: anchor.top - PAD,
        left: anchor.left - PAD,
        width: anchor.width + PAD * 2,
        height: anchor.height + PAD * 2,
      }
    : null;

  return (
    <div className="ctx-tour" role="dialog" aria-modal="true" aria-label="Explore walkthrough">
      {/* Backdrop with a punched-out spotlight. box-shadow paints the dim layer
          around the highlighted rect so the underlying region reads clearly. */}
      <button
        type="button"
        className="ctx-tour-backdrop"
        aria-label="Skip walkthrough"
        onClick={finish}
      />
      {spotlight && (
        <div
          className="ctx-tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      <div
        ref={cardRef}
        className="ctx-tour-card"
        style={{ top: cardPos.top, left: cardPos.left, width: CARD_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ctx-tour-head">
          <span className="ctx-tour-icon">
            <Icon size={13} />
          </span>
          <span className="ctx-tour-eyebrow">{step.eyebrow}</span>
          <button
            type="button"
            className="ctx-tour-close"
            aria-label="Close walkthrough"
            onClick={finish}
          >
            <X size={13} />
          </button>
        </div>

        <h2 className="ctx-tour-title">{step.title}</h2>
        <p className="ctx-tour-body">{step.body}</p>

        <div className="ctx-tour-foot">
          <div className="ctx-tour-dots" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={"ctx-tour-dot" + (i === stepIndex ? " is-active" : "")}
              />
            ))}
          </div>
          <span className="ctx-tour-count">
            {stepIndex + 1} / {STEPS.length}
          </span>
          <div className="ctx-tour-nav">
            {stepIndex > 0 && (
              <button type="button" className="ctx-tour-btn ghost" onClick={prev}>
                Back
              </button>
            )}
            {!isLast && (
              <button type="button" className="ctx-tour-btn ghost" onClick={finish}>
                Skip
              </button>
            )}
            <button type="button" className="ctx-tour-btn primary" onClick={next}>
              {isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export for callers that want the marker icon in menus.
export const WalkthroughIcon = Boxes;
