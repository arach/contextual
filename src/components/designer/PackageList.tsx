// Left rail in the Designer — packages with name, version, brief, and quick
// metadata. Keeps the same Hangar primitives as the rest of the app.
import type { ContextPackage } from "@/data/packages";

interface PackageListProps {
  packages: ContextPackage[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function PackageList({ packages, activeId, onSelect }: PackageListProps) {
  return (
    <div className="h-full overflow-auto p-2">
      <div className="hg-section-label px-2 pt-1 pb-2">packages</div>
      {packages.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={
              "block w-full text-left px-3 py-2.5 mb-1 rounded-[2px] border transition-colors " +
              (active
                ? "hg-reticle bg-[rgba(255,123,44,0.08)] border-[var(--hg-accent)]"
                : "border-transparent hover:bg-[var(--hg-bg-tint)]")
            }
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-medium text-[var(--hg-ink)]">{p.name}</span>
              <span className="ml-auto hg-mono text-[10px] text-[var(--hg-muted)]">
                {p.version}
              </span>
            </div>
            <div className="text-[11.5px] text-[var(--hg-ink-2)] mt-1 line-clamp-2 leading-[1.4]">
              {p.desc}
            </div>
            <div className="mt-1.5 flex gap-2 hg-mono text-[10px] text-[var(--hg-muted)]">
              <span>{p.modules.length} cards</span>
              <span>·</span>
              <span>{p.budget}k</span>
              <span className="ml-auto">{p.updated}</span>
            </div>
          </button>
        );
      })}
      <button className="w-full mt-2 px-3 py-2 border border-dashed border-[var(--hg-hairline)] rounded-[2px] hg-mono text-[10.5px] tracking-wider uppercase text-[var(--hg-muted)] hover:text-[var(--hg-accent)] hover:border-[var(--hg-accent)]">
        + new package
      </button>
    </div>
  );
}
