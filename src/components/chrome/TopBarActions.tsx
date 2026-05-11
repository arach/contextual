// The right-side cluster on the Hudson NavigationBar:
//   - keyboard shortcut hints
//   - session/threads meta
// Branch + send shortcuts are emitted by the composer, but listed here so the
// hints are discoverable from the chrome.

export function TopBarActions({ threadCount }: { threadCount: number }) {
  return (
    <div className="flex items-center gap-4 text-[10.5px] hg-mono text-[var(--hg-muted)]">
      <span>
        <span className="hg-kbd">⌘K</span> jump
        <span className="hg-kbd ml-1">⌘B</span> branch
        <span className="hg-kbd ml-1">⌘↵</span> dispatch
      </span>
      <span className="text-[var(--hg-ink)]">
        <span className="text-[var(--hg-muted)]">session</span>{" "}
        <span className="hg-mono">2026-05-10 14:22</span>
      </span>
      <span className="text-[var(--hg-ink)]">
        <b className="text-[var(--hg-ink)] font-medium">{threadCount}</b>{" "}
        <span className="text-[var(--hg-muted)]">threads</span>
      </span>
    </div>
  );
}
