"use client";

import { RotateCw, Sparkles, Telescope } from "lucide-react";

export function ExploreEmptyState({
  demoForced,
  onStartDemo,
  onRescan,
}: {
  demoForced: boolean;
  onStartDemo: () => void;
  onRescan: () => void;
}) {
  return (
    <div className="ctx-empty">
      <span className="ctx-empty-icon">
        <Telescope size={20} />
      </span>
      <h2 className="ctx-empty-title">No sessions to explore yet</h2>
      <p className="ctx-empty-body">
        Contextual reads agent transcripts from <code>~/.claude</code> and <code>~/.codex</code> on
        this machine. None were found — run a session in Claude Code or Codex, then rescan. Or take
        the guided tour on a curated demo corpus.
      </p>
      <div className="ctx-empty-actions">
        {!demoForced && (
          <button type="button" className="hg-btn primary" onClick={onStartDemo}>
            <Sparkles size={13} />
            Take the demo tour
          </button>
        )}
        <button type="button" className="hg-btn" onClick={onRescan}>
          <RotateCw size={13} />
          Rescan
        </button>
      </div>
      <p className="ctx-empty-hint">Tip: set CONTEXTUAL_DEMO=1 to always boot into the demo corpus.</p>
    </div>
  );
}
