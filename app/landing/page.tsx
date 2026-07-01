import type { Metadata } from "next";

import { Quickstart } from "./Quickstart";
import { ReplayImage } from "./ReplayImage";
import "./landing.css";

const GITHUB_URL = "https://github.com/arach/contextual";

export const metadata: Metadata = {
  title: "Contextual — Context engineering, made visible",
  description:
    "A context planning workbench for agentic engineering. Contextual reads your agent sessions, turns every turn into inspectable context atoms, and shows how the window fills — so you design compact, durable context instead of accumulating noise.",
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
    desc: "Inspect native transcripts as context atoms, buckets, and stale context.",
  },
  {
    index: "S-02",
    label: "Session Replay",
    desc: "Play a session back turn by turn: watch the context window fill, and see what each turn added.",
    feature: true,
  },
  {
    index: "S-03",
    label: "Package",
    desc: "Distill reusable context into versioned artifacts with provenance and freshness rules.",
  },
  {
    index: "S-04",
    label: "Instantiate",
    desc: "Compile packages into a target-specific launch plan.",
  },
  {
    index: "S-05",
    label: "Fork",
    desc: "Derive a new run from explicit prior state — without pretending hidden state continued.",
  },
];

const BOUNDARY = ["observed", "selected", "packaged", "claimed as lineage"];

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
              Demo
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
        <section className="lp-hero">
          <div className="lp-container lp-hero-inner">
            <p className="lp-eyebrow">Context engineering, made visible</p>
            <h1>See what fills your agent&rsquo;s context.</h1>
            <p className="lp-hero-sub">
              Contextual reads your agent sessions, turns every turn into inspectable{" "}
              <strong>context atoms</strong>, and shows how the window fills — turn by turn,
              bucket by bucket. So you design compact, durable context instead of accumulating
              noise.
            </p>
            <div className="lp-hero-cta">
              <a className="lp-btn lp-btn-primary" href="#quickstart">
                Run the demo
              </a>
              <a className="lp-btn" href={GITHUB_URL} target="_blank" rel="noreferrer">
                View on GitHub
              </a>
            </div>

            <figure className="lp-frame lp-hero-frame">
              <figcaption className="lp-frame-bar">
                <span className="lp-frame-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-frame-label">
                  session-observe · <span className="live">demo corpus</span>
                </span>
              </figcaption>
              <ReplayImage priority />
            </figure>
          </div>
        </section>

        {/* ── Positioning band ──────────────────────────────────────── */}
        <section className="lp-section lp-positioning">
          <div className="lp-container lp-two">
            <div>
              <span className="lp-index">01 · Positioning</span>
              <h2>Upstream of the hidden window.</h2>
            </div>
            <div>
              <p className="lp-lede">
                Providers and harnesses own caching, compression, and memory{" "}
                <strong>inside</strong> the model&rsquo;s context window — and they hide it.
                Contextual owns the durable boundary: what was observed, what was selected, what
                was packaged, and what a new run may claim as lineage.
              </p>
              <div className="lp-boundary">
                {BOUNDARY.map((b) => (
                  <span key={b}>{b}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Surfaces grid ─────────────────────────────────────────── */}
        <section className="lp-section lp-surfaces-section">
          <div className="lp-container">
            <div className="lp-head">
              <span className="lp-index">02 · Surfaces</span>
              <h2>Five surfaces, one durable boundary.</h2>
              <p>
                Each surface operates on the same context atoms — from first observation to the
                launch plan for the next run.
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
              <span className="lp-index">03 · Session Replay</span>
              <h2>Watch the window fill.</h2>
              <p className="lp-spotlight-body">
                Most context isn&rsquo;t chosen — it accumulates. Session Replay puts the
                conversation on one axis and the growing context window on the other, joined by a
                single <strong>playhead</strong>. Scrub any turn to see exactly what it added, and
                to which bucket. The point isn&rsquo;t the size — it&rsquo;s seeing where the
                window goes, so your next run starts leaner.
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
                  <b>◆ playhead</b>
                  <span>one cursor joins both — scrub to any turn</span>
                </div>
              </div>
            </div>
            <figure className="lp-frame">
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
              What should the next agent start with — <span className="accent">and why is that
              claim true?</span>
            </p>
          </div>
        </section>

        {/* ── Quickstart ────────────────────────────────────────────── */}
        <section className="lp-section lp-quickstart" id="quickstart">
          <div className="lp-container lp-two">
            <div>
              <span className="lp-index">04 · Quickstart</span>
              <h2>Run it locally.</h2>
              <p className="lp-quickstart-note">
                Clone, install, and boot the workbench against a bundled real demo corpus — no
                keys, no setup.
              </p>
              <p className="lp-caption">
                Runs with a bundled real demo corpus. No API keys. Opens on{" "}
                <code>http://localhost:5180</code>.
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
          <a className="lp-footer-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            github.com/arach/contextual ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
