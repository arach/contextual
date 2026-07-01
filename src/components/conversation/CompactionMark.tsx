export function CompactionMark({ label }: { label: string }) {
  return (
    <div className="my-8 flex items-center gap-3 text-[11px] text-neutral-600">
      <span className="flex-1 border-t border-[var(--hg-line)]" />
      <span>{label}</span>
      <span className="flex-1 border-t border-[var(--hg-line)]" />
    </div>
  );
}
