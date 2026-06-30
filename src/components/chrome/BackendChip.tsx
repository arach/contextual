// Top-bar chip for choosing which backend the active thread dispatches
// through. v1 exposes:
//   - pi · sessions       (pi-coding-agent CLI, native session tree)
//   - anthropic models    (pi-ai, in-process, stateless)
//
// Anthropic options default to OAuth (Claude Pro/Max subscription) so the
// user doesn't burn metered API credits. If not signed in, picking an
// anthropic option triggers the OAuth flow first.
//
// More providers (openai, google, mistral, bedrock) are available via pi-ai
// but not yet surfaced here.

import { useCallback, useEffect, useRef, useState } from "react";
import type { BackendConfig } from "@/types";
import { fetchOAuthStatus, loginOAuth } from "@/lib/backends/client";

interface BackendChipProps {
  value: BackendConfig;
  onChange: (next: BackendConfig) => void;
}

interface Option {
  label: string;
  sublabel: string;
  config: BackendConfig;
  /** Provider id for OAuth (when config.auth.mode === "oauth"). */
  oauthProvider?: string;
}

const OPTIONS: Option[] = [
  {
    label: "pi · sessions",
    sublabel: "native fork/tree",
    config: { backend: "pi-coding-agent" },
  },
  {
    label: "anthropic · opus 4.7",
    sublabel: "pro/max subscription",
    oauthProvider: "anthropic",
    config: {
      backend: "pi-ai",
      provider: "anthropic",
      model: "claude-opus-4-7",
      auth: { mode: "oauth" },
    },
  },
  {
    label: "anthropic · sonnet 4.6",
    sublabel: "pro/max subscription",
    oauthProvider: "anthropic",
    config: {
      backend: "pi-ai",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      auth: { mode: "oauth" },
    },
  },
  {
    label: "anthropic · haiku 4.5",
    sublabel: "pro/max subscription",
    oauthProvider: "anthropic",
    config: {
      backend: "pi-ai",
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      auth: { mode: "oauth" },
    },
  },
];

function describe(cfg: BackendConfig): string {
  if (cfg.backend === "pi-coding-agent") return "pi · sessions";
  return `${cfg.provider} · ${cfg.model.replace(/^claude-/, "").replace(/-\d{8}$/, "")}`;
}

function isSelected(opt: Option, cur: BackendConfig): boolean {
  if (opt.config.backend !== cur.backend) return false;
  if (opt.config.backend === "pi-coding-agent") return true;
  if (cur.backend !== "pi-ai") return false;
  return opt.config.backend === "pi-ai" && opt.config.model === cur.model;
}

export function BackendChip({ value, onChange }: BackendChipProps) {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState<Record<string, boolean>>({});
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refreshAuth = useCallback(() => {
    fetchOAuthStatus()
      .then(setAuthed)
      .catch(() => setAuthed({}));
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (!open) return;
    refreshAuth();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, refreshAuth]);

  const pick = useCallback(
    async (opt: Option) => {
      setAuthError(null);
      if (opt.oauthProvider && !authed[opt.oauthProvider]) {
        setSigningIn(opt.oauthProvider);
        try {
          await loginOAuth(opt.oauthProvider);
          await refreshAuth();
        } catch (e) {
          setAuthError(e instanceof Error ? e.message : String(e));
          setSigningIn(null);
          return;
        }
        setSigningIn(null);
      }
      onChange(opt.config);
      setOpen(false);
    },
    [authed, onChange, refreshAuth],
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "hg-mono text-[10.5px] tracking-[0.12em] uppercase px-3 py-1 rounded-[2px] " +
          "border border-[var(--hg-line)] bg-[var(--hg-bg-tint)] text-[var(--hg-ink)] " +
          "hover:text-[var(--hg-accent)] transition-colors flex items-center gap-1.5"
        }
        title="select backend"
      >
        <span
          className={
            "w-[5px] h-[5px] rounded-full " +
            (value.backend === "pi-ai"
              ? "bg-[var(--hg-accent)] shadow-[0_0_6px_var(--hg-accent)]"
              : "bg-[var(--hg-muted)]")
          }
        />
        {describe(value)}
        <span className="text-[var(--hg-hairline)]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[280px] bg-[var(--hg-surface)] border border-[var(--hg-line)] rounded-[2px] shadow-[var(--ctx-pop-shadow)] p-1">
          {OPTIONS.map((opt) => {
            const selected = isSelected(opt, value);
            const needsAuth = opt.oauthProvider && !authed[opt.oauthProvider];
            const busy = signingIn === opt.oauthProvider;
            return (
              <button
                key={opt.label}
                type="button"
                disabled={busy}
                onClick={() => void pick(opt)}
                className={
                  "w-full text-left px-2.5 py-2 rounded-[2px] flex items-baseline gap-2 " +
                  (selected
                    ? "bg-[var(--hg-bg-tint)] text-[var(--hg-accent)]"
                    : "text-[var(--hg-ink)] hover:bg-[var(--hg-bg-tint)]") +
                  (busy ? " opacity-60" : "")
                }
              >
                <span className="hg-mono text-[10.5px] tracking-wider uppercase">
                  {opt.label}
                </span>
                <span className="hg-mono text-[9px] tracking-wider uppercase text-[var(--hg-muted)] ml-auto">
                  {busy ? "signing in…" : needsAuth ? "sign in" : opt.sublabel}
                </span>
              </button>
            );
          })}
          {authError && (
            <div className="px-2.5 py-2 hg-mono text-[10px] text-[var(--hg-warn)]">
              {authError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
