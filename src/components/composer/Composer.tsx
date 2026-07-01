import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import type { Thread } from "@/types";
import { TOTAL_BUDGET } from "@/types";
import { fmtTokens, tokFor } from "@/lib/tokens";
import { buildManifest } from "@/lib/derive";
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
  const showMeta = focus || overBudget || manifestOpen;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onDispatch();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSend) onDispatch();
    }
  };

  return (
    <div
      className={
        "flex-shrink-0 w-full border-t bg-[var(--hg-surface)] transition-colors " +
        (focus ? "border-[var(--ctx-accent-line)]" : "border-[var(--hg-line)]")
      }
    >
      <div className="flex w-full items-end gap-2 px-4 py-3">
        <textarea
          ref={textareaRef}
          value={thread.composer}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            setTimeout(() => setManifestOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
          placeholder="Message…"
          rows={1}
          className="min-w-0 flex-1 min-h-[36px] max-h-[160px] resize-none border-0 bg-transparent py-1 text-[15px] leading-relaxed text-[var(--hg-ink)] outline-none placeholder:text-[var(--ctx-placeholder)]"
        />
        <button
          type="button"
          aria-label={thinking ? "Sending" : "Send message"}
          className={
            "mb-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full transition-[background-color,transform,opacity] " +
            (canSend
              ? "bg-[var(--ctx-primary)] text-[var(--ctx-primary-fg)] hover:scale-[1.04] active:scale-[0.98]"
              : "bg-[var(--ctx-primary-muted)] text-[var(--ctx-primary-muted-fg)] cursor-default")
          }
          onClick={onDispatch}
          disabled={!canSend}
        >
          {thinking ? (
            <Loader2 size={16} className="animate-spin" strokeWidth={2.25} />
          ) : (
            <ArrowUp size={17} strokeWidth={2.25} />
          )}
        </button>
      </div>

      {showMeta && (
        <div className="flex w-full items-center gap-3 border-t border-[var(--hg-line)]/60 px-4 py-2 text-[11px] text-neutral-500">
          <span className={overBudget ? "text-[var(--ctx-warn)]" : undefined}>
            {fmtTokens(callTokens)} / {fmtTokens(TOTAL_BUDGET)}
            {overBudget ? " · over window" : ""}
          </span>
          <span className="flex-1" />
          <div className="relative">
            <button
              type="button"
              className="text-neutral-500 hover:text-neutral-300 underline-offset-2 hover:underline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setManifestOpen((o) => !o)}
            >
              {manifestOpen ? "Hide details" : "Call details"}
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
      )}
    </div>
  );
}
