"use client";

import { useState } from "react";
import { FolderInput, RotateCw, Sparkles, Telescope } from "lucide-react";

export function ExploreEmptyState({
  demoForced,
  onStartDemo,
  onRescan,
  onImportPath,
}: {
  demoForced: boolean;
  onStartDemo: () => void;
  onRescan: () => void;
  /** Pull + analyze a transcript at an absolute path. Resolves to an error string, or null on success. */
  onImportPath: (path: string) => Promise<string | null>;
}) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = path.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const err = await onImportPath(trimmed);
    setBusy(false);
    if (err) setError(err);
    else setPath("");
  };

  return (
    <div className="ctx-empty">
      <span className="ctx-empty-icon">
        <Telescope size={20} />
      </span>
      <h2 className="ctx-empty-title">No sessions to explore yet</h2>
      <p className="ctx-empty-body">
        Contextual reads agent transcripts from <code>~/.claude</code> and <code>~/.codex</code> on
        this machine. None were found — import one directly by path below, run a session then rescan,
        or take the guided tour on a curated demo corpus.
      </p>

      <div className="mx-auto mt-1 w-full max-w-[440px] text-left">
        <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--hg-muted)]">
          Import a session by path
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={path}
            spellCheck={false}
            onChange={(event) => {
              setPath(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="/Users/you/.codex/sessions/…/rollout-….jsonl"
            className="min-w-0 flex-1 rounded-[3px] border border-[var(--hg-line)] bg-[var(--hg-surface)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--hg-ink)] outline-none placeholder:text-[var(--hg-muted)] focus:border-[var(--hg-accent)]"
          />
          <button
            type="button"
            className="hg-btn primary"
            onClick={() => void submit()}
            disabled={busy || !path.trim()}
          >
            <FolderInput size={13} />
            {busy ? "Reading…" : "Import"}
          </button>
        </div>
        {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
      </div>

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
