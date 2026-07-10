import type { Metadata } from "next";
import { ArrowRight, Github, Play } from "lucide-react";

import { Quickstart } from "./Quickstart";
import { ReplayImage } from "./ReplayImage";
import "./landing.css";

const GITHUB_URL = "https://github.com/arach/contextual";
const APP_URL = "/";

export const metadata: Metadata = {
  title: "Contextual — agent context workbench",
  description:
    "Contextual reads prior agent sessions and shows how the context window fills up, turn by turn, so you can trim noise before the next run.",
};

interface Surface {
  index: string;
  label: string;
  desc: string;
  feature?: boolean;
}

const SURFACES: Surface[] = [
  {
    index: "S-01",
    label: "Explore",
    desc: "Read native transcripts, manifests, and Contextual atoms side by side.",
  },
  {
    index: "S-02",
    label: "Session Replay",
    desc: "Scrub a run turn by turn and see what each turn added.",
    feature: true,
  },
  {
    index: "S-03",
    label: "Package",
    desc: "Distill reusable starting context with provenance and freshness rules.",
  },
  {
    index: "S-04",
    label: "Instantiate",
    desc: "Compile packages into a target-specific launch plan before a run starts.",
  },
  {
    index: "S-05",
    label: "Fork",
    desc: "Start from explicit prior state, with no pretending the old hidden state carried over.",
  },
];

const PIPELINE = [
  { label: "Transcript", desc: "what the harness actually wrote" },
  { label: "Atom", desc: "one inspectable unit of context" },
  { label: "Bucket", desc: "job, codebase, tools, verification, decisions" },
  { label: "Package", desc: "versioned context with sources" },
  { label: "Plan", desc: "launch or fork input the agent can audit" },
];

const HERO_PROOF = [
  ["Reads", "~/.claude + ~/.codex"],
  ["Models", "atoms, buckets, source refs"],
  ["Shows", "turn-by-turn accumulation"],
  ["Avoids", "hidden-state promises"],
] as const;

export default function LandingPage() {
  return (
    <div className="lp">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="lp-nav">
        <nav className="lp-container lp-nav-inner" aria-label="Primary">
          <a className="lp-wordmark" href="#top" aria-label="Contextual home">
            <span className="dot" aria-hidden />
            Contextual
          </a>
          <div className="lp-nav-links">
            <a className="lp-nav-link" href="#quickstart">
              Quickstart
            </a>
            <a className="lp-nav-link" href={APP_URL}>
              App
            </a>
            <a
              className="lp-nav-link"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </nav>
      </header>

      <main id="top">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="lp-hero" aria-labelledby="landing-title">
          <div className="lp-hero-media" aria-hidden="true">
            <ReplayImage priority />
          </div>
          <div className="lp-container lp-hero-inner">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow">See what fills your agent&rsquo;s context</p>
              <h1 id="landing-title">Contextual</h1>
              <p className="lp-hero-sub">
                Contextual reads your agent sessions and shows how the window fills up — turn by
                turn, grouped by what it is for. Trim the noise before the next run instead of
                discovering it afterward.
              </p>
              <div className="lp-hero-cta">
                <a className="lp-btn lp-btn-primary" href="#quickstart">
                  <Play size={14} aria-hidden />
                  Run locally
                </a>
                <a className="lp-btn" href={APP_URL}>
                  <ArrowRight size={14} aria-hidden />
                  Open app
                </a>
                <a className="lp-btn" href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <Github size={14} aria-hidden />
                  GitHub
                </a>
              </div>
            </div>

            <dl className="lp-hero-proof" aria-label="Contextual capabilities">
              {HERO_PROOF.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Positioning band ──────────────────────────────────────── */}
        <section className="lp-section lp-positioning">
          <div className="lp-container lp-two">
            <div>
              <span className="lp-index">01 · Positioning</span>
              <h2>Context you can actually read.</h2>
            </div>
            <div>
              <p className="lp-lede">
                Agent sessions collect prompts, files, tool output, and back-and-forth. You can
                usually read the transcript, but not the breakdown of what filled the working
                window. Contextual reconstructs that from the session evidence so you can decide
                what to keep.
              </p>
            </div>
          </div>
        </section>

        {/* ── Evidence pipeline ─────────────────────────────────────── */}
        <section className="lp-section lp-pipeline-section">
          <div className="lp-container">
            <div className="lp-head">
              <span className="lp-index">02 · Evidence model</span>
              <h2>From raw turns to a launchable plan.</h2>
              <p>
                Contextual keeps each transformation visible, so a developer or agent can audit
                where context came from before spending a new model turn.
              </p>
            </div>
            <ol className="lp-pipeline" aria-label="Contextual evidence pipeline">
              {PIPELINE.map((step, index) => (
                <li key={step.label}>
                  <span className="lp-pipeline-step">{String(index + 1).padStart(2, "0")}</span>
                  <b>{step.label}</b>
                  <p>{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Surfaces grid ─────────────────────────────────────────── */}
        <section className="lp-section lp-surfaces-section">
          <div className="lp-container">
            <div className="lp-head">
              <span className="lp-index">03 · Surfaces</span>
              <h2>Five views of the same session.</h2>
              <p>
                Each surface works from the same transcript evidence, from first observation to the
                package or launch plan for the next run.
              </p>
            </div>
            <div className="lp-surfaces">
              {SURFACES.map((s) => (
                <article
                  key={s.label}
                  className={"lp-surface-card" + (s.feature ? " is-feature" : "")}
                >
                  <div className="lp-surface-top">
                    <span className="lp-surface-idx">{s.index}</span>
                    {s.feature ? <span className="lp-chip">New</span> : null}
                  </div>
                  <div className="lp-surface-label">{s.label}</div>
                  <p className="lp-surface-desc">{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Session Replay spotlight ──────────────────────────────── */}
        <section className="lp-section lp-spotlight">
          <div className="lp-container lp-two">
            <div>
              <span className="lp-index">04 · Session Replay</span>
              <h2>Watch the window fill.</h2>
              <p className="lp-spotlight-body">
                Most context is not selected. It piles up. Session Replay puts the conversation on
                one axis and the growing working window on the other, joined by a single{" "}
                <strong>playhead</strong>. Scrub any turn to see what it added, which bucket it
                landed in, and whether it belongs in the next run.
              </p>
              <div className="lp-axes">
                <div className="lp-axis">
                  <b>X · turns</b>
                  <span>the conversation, one row per turn</span>
                </div>
                <div className="lp-axis">
                  <b>Y · window</b>
                  <span>cumulative tokens, stacked by bucket</span>
                </div>
                <div className="lp-axis">
                  <b>playhead</b>
                  <span>one cursor joins both — scrub to any turn</span>
                </div>
              </div>
            </div>
            <figure className="lp-frame lp-spotlight-frame">
              <figcaption className="lp-frame-bar">
                <span className="lp-frame-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-frame-label">
                  impact of turn 16 · <span className="live">+183 → codebase</span>
                </span>
              </figcaption>
              <ReplayImage />
            </figure>
          </div>
        </section>

        {/* ── Closing tagline ───────────────────────────────────────── */}
        <section className="lp-section lp-closing">
          <div className="lp-container">
            <p>
              Design the context you hand off. <span className="accent">Do not inherit it.</span>
            </p>
            <a className="lp-btn lp-btn-primary" href="#quickstart">
              <Play size={14} aria-hidden />
              Run locally
            </a>
          </div>
        </section>

        {/* ── Quickstart ────────────────────────────────────────────── */}
        <section className="lp-section lp-quickstart" id="quickstart">
          <div className="lp-container lp-two">
            <div>
              <span className="lp-index">05 · Quickstart</span>
              <h2>Run it locally.</h2>
              <p className="lp-quickstart-note">
                Clone, install, and boot the workbench against bundled demo sessions. No accounts,
                no API keys, no local transcript setup.
              </p>
              <p className="lp-caption">
                Starts the local Next app on <code>http://localhost:5180</code>.
              </p>
            </div>
            <div>
              <Quickstart />
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <p className="lp-footer-tag">
            <b>Contextual</b> — a context planning workbench for agentic engineering.
          </p>
          <a className="lp-footer-link" href={APP_URL}>
            open app
          </a>
          <a className="lp-footer-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            github.com/arach/contextual ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
