import type { LoadPhase } from "@/lib/sessionLoadPhase";
import { loadPhaseLabel } from "@/lib/sessionLoadPhase";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={
        "animate-pulse rounded-[2px] bg-[var(--hg-bg-tint)] " + (className ?? "h-3 w-full")
      }
    />
  );
}

export function ExploreNavSkeleton() {
  return (
    <div className="space-y-1.5 px-3 py-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] px-2.5 py-2"
        >
          <SkeletonBlock className="mb-2 h-2 w-16" />
          <SkeletonBlock className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function ExploreWorkbenchSkeleton({ title = "SESSION ANALYSIS" }: { title?: string }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[var(--hg-bg)]">
      <div className="border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)] px-9 pb-5 pt-7">
        <h2 className="m-0 hg-mono text-[24px] font-medium uppercase tracking-wider text-[var(--hg-ink)]">
          {title}
        </h2>
        <SkeletonBlock className="mt-3 h-2.5 w-48" />
      </div>
      <div className="flex flex-1 gap-4 px-9 py-6">
        <div className="w-56 shrink-0 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-7 w-full" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-16 w-3/4" />
        </div>
      </div>
    </section>
  );
}

export function ExploreInspectorSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-[2px] border border-[var(--hg-line)] bg-[var(--hg-surface)] p-3">
        <SkeletonBlock className="mb-3 h-2 w-24" />
        <SkeletonBlock className="h-2 w-full" />
      </div>
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-7 w-full" />
        ))}
      </div>
      <SkeletonBlock className="h-3 w-full" />
      {Array.from({ length: 5 }).map((_, index) => (
        <SkeletonBlock key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function ExploreLoadPhaseBanner({ phase }: { phase: LoadPhase }) {
  const label = loadPhaseLabel(phase);
  if (!label || phase.stage === "ready") return null;

  return (
    <div className="mb-4 rounded-[2px] border border-dashed border-[var(--hg-hairline)] bg-[var(--hg-bg-tint)] px-3 py-2">
      <div className="hg-mono text-[9px] uppercase tracking-wider text-[var(--hg-muted)]">
        {label}
      </div>
    </div>
  );
}
