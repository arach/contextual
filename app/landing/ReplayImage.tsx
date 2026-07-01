"use client";

import { useState } from "react";

/* Normalised sample grid for the fallback stacked-area "accumulation mountain".
 * x: 0..1 across the chart; fill: how full the window is at that turn (0..1). */
const XS = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84, 0.93, 1] as const;
const FILL = [0.05, 0.11, 0.16, 0.23, 0.31, 0.41, 0.53, 0.67, 0.75, 0.81] as const;
/* Cumulative bucket weights (job, codebase, tools, verification, collab). */
const CUM = [0.42, 0.66, 0.8, 0.92, 1] as const;
const BANDS = [
  { fill: "#ff7b2c", opacity: 0.9 },
  { fill: "#5c6b78", opacity: 0.85 },
  { fill: "#495562", opacity: 0.85 },
  { fill: "#38424c", opacity: 0.9 },
  { fill: "#2a323b", opacity: 0.95 },
] as const;

const PAD_L = 70;
const PAD_R = 964;
const BASE_Y = 496;
const TOP_Y = 96;
const CHART_H = BASE_Y - TOP_Y;
const PLAYHEAD_I = 5; // sample index for the playhead marker

const px = (i: number): number => PAD_L + XS[i] * (PAD_R - PAD_L);
const py = (frac: number): number => BASE_Y - frac * CHART_H;

/** Build one stacked band as a closed area path (top edge L→R, bottom R→L). */
function bandPath(lowerCum: number, upperCum: number): string {
  const top = XS.map((_, i) => `${px(i)},${py(FILL[i] * upperCum)}`);
  const bottom = XS.map((_, i) => `${px(i)},${py(FILL[i] * lowerCum)}`).reverse();
  return `M${top.join(" L")} L${bottom.join(" L")} Z`;
}

/** SVG fallback that echoes the Session Replay accumulation mountain. */
function AccumulationMountain() {
  const playX = px(PLAYHEAD_I);
  return (
    <svg
      className="lp-frame-fallback"
      viewBox="0 0 1024 620"
      role="img"
      aria-label="Illustration of a context window filling turn by turn, stacked by bucket"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="0" y="0" width="1024" height="620" fill="#0a0c0f" />
      {/* horizontal grid */}
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line
          key={g}
          x1={PAD_L}
          x2={PAD_R}
          y1={BASE_Y - g * CHART_H}
          y2={BASE_Y - g * CHART_H}
          stroke="#ffffff"
          strokeOpacity={0.05}
        />
      ))}
      {/* stacked bands, bottom → top */}
      {BANDS.map((b, i) => (
        <path
          key={b.fill}
          d={bandPath(i === 0 ? 0 : CUM[i - 1], CUM[i])}
          fill={b.fill}
          fillOpacity={b.opacity}
        />
      ))}
      {/* playhead */}
      <line x1={playX} x2={playX} y1={TOP_Y - 12} y2={BASE_Y} stroke="#ff7b2c" strokeWidth={1.5} />
      <path d={`M${playX} ${TOP_Y - 18} l6 8 -6 8 -6 -8 Z`} fill="#ff7b2c" />
      {/* axis */}
      <line x1={PAD_L} x2={PAD_R} y1={BASE_Y} y2={BASE_Y} stroke="#29333d" />
      <text
        x={PAD_L}
        y={70}
        fill="#5e6a74"
        fontFamily="ui-monospace, monospace"
        fontSize="15"
        letterSpacing="2"
      >
        ACCUMULATION · CUMULATIVE WINDOW TOKENS BY TURN
      </text>
      <text
        x={PAD_L}
        y={560}
        fill="#7f8b96"
        fontFamily="ui-monospace, monospace"
        fontSize="13"
      >
        job · codebase · tools · verification · collab
      </text>
    </svg>
  );
}

export function ReplayImage({ priority = false }: { priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AccumulationMountain />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/landing/replay-hero.png"
      alt="Contextual Session Replay: a session list, the cumulative context-window accumulation chart with a playhead at turn 16, the turn-by-turn conversation timeline, and an impact panel showing that turn added +183 tokens to the codebase bucket."
      width={2680}
      height={1766}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
