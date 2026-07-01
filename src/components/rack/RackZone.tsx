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
    <div className="flex items-baseline gap-2 px-1 pt-3 pb-1.5 mb-0.5 border-b border-[var(--hg-line)]">
      <span className="font-mono text-[10px] tracking-wider uppercase text-neutral-400">
        {label}
      </span>
      <span className="font-mono text-[10px] tracking-wide text-neutral-600 normal-case">
        {sublabel}
      </span>
      {meta && (
        <span className="font-mono text-[9.5px] text-neutral-600 ml-auto tracking-wide normal-case">
          {meta}
        </span>
      )}
    </div>
  );
}
