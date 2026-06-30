// A single editable module card in the Designer. ContentEditable surfaces
// make name + body feel directly manipulable; chips/pills round out the
// information density without yet wiring real persistence.

import type { ContextModule } from "@/types";
import { fmtTokens } from "@/lib/tokens";

interface PackageCardProps {
  module: ContextModule;
}

export function PackageCard({ module }: PackageCardProps) {
  const palette = chipPalette(module.kind);
  return (
    <div className="bg-[var(--hg-surface)] border border-[var(--hg-line)] rounded-[2px] p-4 pb-3 relative shadow-[var(--ctx-card-shadow)] hover:shadow-[var(--ctx-card-shadow-hover)] transition-shadow">
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-dashed border-[var(--hg-hairline)]">
        <span
          className="ctx-pkg-swatch hg-mono text-[9.5px] tracking-wider uppercase px-2 py-[3px] rounded-[2px] flex-shrink-0"
          style={palette}
        >
          {module.kind}
        </span>
        <span className="hg-mono text-[9.5px] tracking-wider uppercase text-[var(--hg-muted)]">
          {module.id}
        </span>
        <span className="ml-auto hg-mono text-[10.5px] text-[var(--hg-muted)]">
          <b className="text-[var(--hg-ink)] font-medium">{fmtTokens(module.tokens)}</b> tok
        </span>
      </div>

      <div
        contentEditable
        suppressContentEditableWarning
        className="hg-mono text-[14px] font-medium text-[var(--hg-ink)] leading-[1.25] mb-2 border border-dashed border-transparent hover:border-[var(--hg-hairline)] focus:border-[var(--hg-accent)] focus:outline-none rounded-[2px] -mx-1.5 px-1.5 py-1 cursor-text uppercase tracking-wider"
      >
        {module.name}
      </div>

      <div
        contentEditable
        suppressContentEditableWarning
        className="text-[13px] text-[var(--hg-ink-2)] leading-[1.5] border border-dashed border-transparent hover:border-[var(--hg-hairline)] focus:border-[var(--hg-accent)] focus:outline-none rounded-[2px] -mx-2 px-2 py-1.5 cursor-text min-h-[64px] whitespace-pre-wrap"
      >
        {module.body}
      </div>

      <div className="mt-2.5 pt-2 border-t border-dashed border-[var(--hg-hairline)] flex items-center gap-1.5 flex-wrap hg-mono text-[10px] text-[var(--hg-muted)]">
        <span className="hg-pill">core</span>
        <span className="hg-pill">v0.3</span>
        <span className="hg-pill border-dashed cursor-pointer hover:text-[var(--hg-accent)] hover:border-[var(--hg-accent)]">
          + tag
        </span>
        <span className="ml-auto cursor-pointer px-1.5 hover:text-[var(--hg-accent)]" title="duplicate">
          ⎘
        </span>
        <span className="cursor-pointer px-1.5 hover:text-[var(--hg-accent)]" title="history">
          ⏱
        </span>
        <span className="cursor-pointer px-1.5 hover:text-[var(--hg-warn)]" title="remove">
          ×
        </span>
      </div>
    </div>
  );
}

function chipPalette(kind: string): { background: string; color: string } {
  switch (kind) {
    case "rules":
      return { background: "#7a5a7a", color: "var(--hg-ink)" };
    case "doc":
      return { background: "#5a7a5a", color: "var(--hg-bg)" };
    case "log":
      return { background: "#8a6a3a", color: "var(--hg-bg)" };
    default:
      return { background: "var(--hg-ink-2)", color: "var(--hg-bg)" };
  }
}
