// The launch console: composer textarea, draft/call token readout, manifest
// popover, and the orange DISPATCH button. Wraps the whole bottom area of
// the center pane.
import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Thread } from "@/types";
import { TOTAL_BUDGET } from "@/types";
import { fmtTokens, tokFor } from "@/lib/tokens";
import { buildManifest } from "@/lib/derive";
import { LaunchBar } from "@/components/composer/LaunchBar";
import { Manifest } from "@/components/composer/Manifest";

interface ComposerProps {
  thread: Thread;
  thinking: boolean;
  onChange: (v: string) => void;
  onDispatch: () => void;
}

export function Composer({ thread, thinking, onChange, onDispatch }: ComposerProps) {
  const [focus, setFocus] = useState(false);
  const [manifestOpen, setManifestOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const draftTokens = tokFor(thread.composer);
  const manifest = buildManifest(thread);
  const callTokens = manifest.total + draftTokens;
  const overBudget = callTokens > TOTAL_BUDGET;
  const canSend = !thinking && thread.composer.trim().length > 0;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSend) onDispatch();
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-6 py-3">
      <LaunchBar
        fixedTokens={manifest.fixedTokens}
        softTokens={manifest.softTokens}
        draftTokens={draftTokens}
      />

      <div className="flex items-center gap-2 mb-2">
        <span className="flex-1" />
        <div className="relative">
          <button
            type="button"
            className="hg-btn"
            onClick={() => setManifestOpen((o) => !o)}
          >
            manifest ▾
          </button>
          {manifestOpen && (
            <Manifest
              callNumber={thread.turn + 1}
              fixed={manifest.fixed}
              softLive={manifest.softLive}
              task={thread.task}
              draftTokens={draftTokens}
              totalTokens={callTokens}
              onClose={() => setManifestOpen(false)}
            />
          )}
        </div>
      </div>

      <div
        className={
          "bg-[var(--hg-surface)] border rounded-[2px] px-3.5 py-3 flex flex-col gap-2 transition-shadow " +
          (focus
            ? "border-[var(--hg-accent)] shadow-[0_0_0_3px_rgba(255,123,44,0.15)]"
            : "border-[var(--hg-line)]")
        }
      >
        <textarea
          ref={textareaRef}
          value={thread.composer}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onKeyDown={onKeyDown}
          placeholder={`message ${thread.name}/${thread.activeBranch}…`}
          className="border-0 outline-none resize-none font-[inherit] text-[14px] bg-transparent text-[var(--hg-ink)] min-h-[36px] max-h-[140px] leading-[1.5] hg-mono"
        />
        <div className="flex items-center gap-2.5 hg-mono text-[10.5px] text-[var(--hg-muted)] tracking-wider uppercase">
          <span>↑↓ history</span>
          <span>·</span>
          <span>⌘↵ dispatch</span>
          <span className="flex-1" />
          <span className={overBudget ? "text-[var(--hg-warn)]" : ""}>
            draft <b className={overBudget ? "text-[var(--hg-warn)]" : "text-[var(--hg-ink)] font-medium"}>{draftTokens}t</b>{" "}
            · call <b className={overBudget ? "text-[var(--hg-warn)]" : "text-[var(--hg-ink)] font-medium"}>{fmtTokens(callTokens)}</b>
          </span>
          <button
            className="hg-btn primary"
            onClick={onDispatch}
            disabled={!canSend}
          >
            {thinking ? "…composing" : "dispatch ↵"}
          </button>
        </div>
      </div>
    </div>
  );
}
