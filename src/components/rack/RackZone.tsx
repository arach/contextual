// Section header for a rack zone (now / fixed / soft). Mono uppercase label,
// orange "callsign" sublabel, count + tokens on the right.
import type { ReactNode } from "react";

interface RackZoneProps {
  label: string;
  sublabel: string;
  meta?: ReactNode;
}

export function RackZone({ label, sublabel, meta }: RackZoneProps) {
  return (
    <div className="flex items-baseline gap-2 px-1 pt-2 pb-1.5 mb-1 border-b border-dashed border-[var(--hg-hairline)]">
      <span className="hg-mono text-[10.5px] tracking-wider uppercase text-[var(--hg-ink-2)] font-medium">
        {label}
      </span>
      <span className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-accent)]">
        — {sublabel}
      </span>
      {meta && (
        <span className="hg-mono text-[10px] text-[var(--hg-muted)] ml-auto tracking-wider uppercase">
          {meta}
        </span>
      )}
    </div>
  );
}
