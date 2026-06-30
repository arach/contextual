// Right rail in the Designer — package metadata, budget allocation, version
// history, and the publish CTA. All edit affordances are visual today; this
// surface is mostly about reading and confirming the shape of the package.

import type { ContextPackage } from "@/data/packages";
import type { ContextModule } from "@/types";
import { fmtTokens, sumTokens } from "@/lib/tokens";

interface PackageMetaProps {
  pkg: ContextPackage;
  modules: ContextModule[];
}

export function PackageMeta({ pkg, modules }: PackageMetaProps) {
  const total = sumTokens(modules);
  return (
    <div className="h-full overflow-auto p-5">
      <div className="hg-section-label mb-3">package · {pkg.name}</div>

      <Row label="name" value={pkg.name} />
      <Row label="version" value={pkg.version} mono />

      <div className="py-3 border-b border-dashed border-[var(--hg-hairline)]">
        <div className="hg-section-label mb-1.5">
          budget allocation · {pkg.budget}k of 100k
        </div>
        <div className="h-[7px] rounded-[2px] bg-[var(--hg-bg-tint)] border border-[var(--hg-line)] overflow-hidden my-1.5">
          <div className="h-full bg-[var(--hg-accent)]" style={{ width: pkg.budget + "%" }} />
        </div>
        <div className="flex justify-between hg-mono text-[10px] text-[var(--hg-muted)]">
          <span>cards loaded</span>
          <span>
            <b className="text-[var(--hg-ink)] font-medium">{fmtTokens(total)}</b> tok
          </span>
        </div>
      </div>

      <div className="py-3 border-b border-dashed border-[var(--hg-hairline)]">
        <div className="hg-section-label mb-2">used by threads</div>
        <div className="flex gap-1.5 flex-wrap">
          {pkg.usedByThreads.map((t) => (
            <span key={t} className="hg-pill">
              {t}
            </span>
          ))}
        </div>
      </div>

      <Row label="access" value="workspace · read+write" mono />

      <div className="py-3">
        <div className="hg-section-label mb-2">history</div>
        <div className="hg-mono text-[10.5px] text-[var(--hg-muted)] leading-[1.7]">
          {pkg.history.map((h) => (
            <div key={h.version} className="flex gap-2">
              <b className="text-[var(--hg-ink)] font-medium">{h.version}</b>
              <span>· {h.when}</span>
              <span>· {h.note}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="hg-btn primary w-full justify-center mt-3">publish package v0.5 ↑</button>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-2.5 border-b border-dashed border-[var(--hg-hairline)]">
      <div className="hg-section-label mb-1">{label}</div>
      <div
        contentEditable
        suppressContentEditableWarning
        className={
          (mono ? "hg-mono text-[11.5px] " : "text-[13px] ") +
          "text-[var(--hg-ink)] border border-dashed border-transparent hover:border-[var(--hg-hairline)] focus:border-[var(--hg-accent)] focus:outline-none rounded-[2px] -mx-1.5 px-1.5 py-0.5 cursor-text"
        }
      >
        {value}
      </div>
    </div>
  );
}
