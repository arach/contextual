// 10-segment monospace VU meter for thread status. Lit count signals load.
export function VuMeter({ lit, segments = 10 }: { lit: number; segments?: number }) {
  return (
    <div className="mt-1.5 flex gap-[1px] h-[5px]">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={
            "flex-1 rounded-[1px] " +
            (i < lit ? "bg-[var(--hg-accent)]" : "bg-[var(--hg-bg-tint)]")
          }
        />
      ))}
    </div>
  );
}
