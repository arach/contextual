// Top-bar chip for choosing which backend the active thread dispatches
// through. v1 exposes:
//   - pi · sessions       (pi-coding-agent CLI, native session tree)
//   - anthropic models    (pi-ai, in-process, stateless)
//
// More providers (openai, google, mistral, bedrock) are available via pi-ai
// but not yet surfaced here.

import { useEffect, useRef, useState } from "react";
import type { BackendConfig } from "@/types";

interface BackendChipProps {
  value: BackendConfig;
  onChange: (next: BackendConfig) => void;
}

interface Option {
  label: string;
  sublabel: string;
  config: BackendConfig;
}

const OPTIONS: Option[] = [
  {
    label: "pi · sessions",
    sublabel: "native fork/tree",
    config: { backend: "pi-coding-agent" },
  },
  {
    label: "anthropic · opus 4.7",
    sublabel: "stateless via pi-ai",
    config: {
      backend: "pi-ai",
      provider: "anthropic",
      model: "claude-opus-4-7",
      auth: { mode: "api-key" },
    },
  },
  {
    label: "anthropic · sonnet 4.6",
    sublabel: "stateless via pi-ai",
    config: {
      backend: "pi-ai",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      auth: { mode: "api-key" },
    },
  },
  {
    label: "anthropic · haiku 4.5",
    sublabel: "stateless via pi-ai",
    config: {
      backend: "pi-ai",
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      auth: { mode: "api-key" },
    },
  },
];

function describe(cfg: BackendConfig): string {
  if (cfg.backend === "pi-coding-agent") return "pi · sessions";
  return `${cfg.provider} · ${cfg.model.replace(/^claude-/, "")}`;
}

function isSelected(opt: Option, cur: BackendConfig): boolean {
  if (opt.config.backend !== cur.backend) return false;
  if (opt.config.backend === "pi-coding-agent") return true;
  if (cur.backend !== "pi-ai") return false;
  return opt.config.backend === "pi-ai" && opt.config.model === cur.model;
}

export function BackendChip({ value, onChange }: BackendChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

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
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[260px] bg-[var(--hg-surface)] border border-[var(--hg-line)] rounded-[2px] shadow-[0_12px_30px_-16px_rgba(0,0,0,0.7)] p-1"
        >
          {OPTIONS.map((opt) => {
            const selected = isSelected(opt, value);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  onChange(opt.config);
                  setOpen(false);
                }}
                className={
                  "w-full text-left px-2.5 py-2 rounded-[2px] flex items-baseline gap-2 " +
                  (selected
                    ? "bg-[var(--hg-bg-tint)] text-[var(--hg-accent)]"
                    : "text-[var(--hg-ink)] hover:bg-[var(--hg-bg-tint)]")
                }
              >
                <span className="hg-mono text-[10.5px] tracking-wider uppercase">
                  {opt.label}
                </span>
                <span className="hg-mono text-[9px] tracking-wider uppercase text-[var(--hg-muted)] ml-auto">
                  {opt.sublabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
