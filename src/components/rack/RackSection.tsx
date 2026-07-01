import type { ReactNode } from "react";

interface RackSectionProps {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function RackSection({ title, summary, open, onToggle, children }: RackSectionProps) {
  return (
    <section className="mb-3">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-1 py-2 text-left hover:bg-[var(--hg-bg-tint)]/50 rounded-sm"
        onClick={onToggle}
      >
        <span className="text-neutral-600 text-[10px] w-3">{open ? "▾" : "▸"}</span>
        <span className="text-[12px] text-neutral-300">{title}</span>
        <span className="ml-auto text-[11px] text-neutral-600 truncate">{summary}</span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </section>
  );
}
