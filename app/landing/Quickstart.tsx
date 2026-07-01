"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

const COMMANDS = [
  "git clone https://github.com/arach/contextual",
  "cd contextual && bun run setup && bun install",
  "CONTEXTUAL_DEMO=1 bun dev",
] as const;

const RAW = COMMANDS.join("\n");

export function Quickstart() {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    void navigator.clipboard
      .writeText(RAW)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {
        /* clipboard unavailable — no-op, the block is still selectable */
      });
  }, []);

  return (
    <div className="lp-code">
      <div className="lp-code-bar">
        <span className="lp-code-title">terminal — quickstart</span>
        <button
          type="button"
          className={"lp-copy" + (copied ? " is-copied" : "")}
          onClick={onCopy}
          aria-label={copied ? "Commands copied to clipboard" : "Copy commands to clipboard"}
        >
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>
          <span className="tok-prompt">$ </span>
          <span className="tok-cmd">git clone </span>
          <span className="tok-dim">https://github.com/arach/contextual</span>
          {"\n"}
          <span className="tok-prompt">$ </span>
          <span className="tok-cmd">cd contextual && bun run setup && bun install</span>
          {"\n"}
          <span className="tok-prompt">$ </span>
          <span className="tok-env">CONTEXTUAL_DEMO=1</span>
          <span className="tok-cmd"> bun dev</span>
        </code>
      </pre>
    </div>
  );
}
