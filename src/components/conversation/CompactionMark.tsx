// Horizontal "turns 1–20 · compacted" divider that breaks the conversation
// into compaction epochs. Pure presentational.
export function CompactionMark({ label }: { label: string }) {
  return (
    <div className="my-5 hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)] flex gap-2 items-center">
      <span className="flex-1 border-t border-dashed border-[var(--hg-hairline)]" />
      {label}
      <span className="flex-1 border-t border-dashed border-[var(--hg-hairline)]" />
    </div>
  );
}
