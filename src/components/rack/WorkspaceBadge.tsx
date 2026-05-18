// Small synced-to-pi indicator in the rack header. Reads
// /api/pi/workspace?threadId=… on mount and whenever the active thread or
// the Fixed module list changes, so it reflects what's actually on disk.

import { useEffect, useState } from "react";
import { fetchWorkspace, type WorkspaceFile } from "@/lib/backends/client";

interface WorkspaceBadgeProps {
  threadId: string;
  /** Refetch key — bump from the parent whenever a dispatch may have changed
   *  the workspace on disk. */
  syncTick?: number;
}

export function WorkspaceBadge({ threadId, syncTick = 0 }: WorkspaceBadgeProps) {
  const [files, setFiles] = useState<WorkspaceFile[] | null>(null);
  const [open, setOpen] = useState(false);
  const [workspaceDir, setWorkspaceDir] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetchWorkspace(threadId)
      .then((d) => {
        if (cancelled) return;
        setFiles(d.files);
        setWorkspaceDir(d.workspaceDir);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, syncTick]);

  const count = files?.length ?? 0;
  const synced = count > 0;
  const home = workspaceDir.replace(/^\/Users\/[^/]+\//, "~/");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "hg-pill " +
          "cursor-pointer flex items-center gap-1.5 transition-colors"
        }
        title={workspaceDir || "no workspace yet"}
      >
        <span
          className={
            "w-[5px] h-[5px] rounded-full " +
            (synced ? "bg-neutral-500" : "bg-neutral-700")
          }
        />
        {synced ? `pi · ${count} file${count > 1 ? "s" : ""}` : "pi · not synced"}
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[300px] bg-[var(--hg-surface)] border border-[var(--hg-line)] rounded-[2px] shadow-[0_12px_30px_-16px_rgba(0,0,0,0.7)] p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hg-mono text-[9.5px] tracking-wider uppercase text-[var(--hg-muted)] mb-2">
            workspace · {home}
          </div>
          {files && files.length > 0 ? (
            files.map((f) => (
              <div
                key={f.relpath}
                className="flex justify-between items-baseline py-1 border-b border-dotted border-[var(--hg-hairline)] last:border-b-0 hg-mono text-[10.5px]"
              >
                <span className="text-[var(--hg-ink)] truncate flex-1">{f.relpath}</span>
                <span className="text-[var(--hg-muted)] ml-2">{f.bytes}b</span>
              </div>
            ))
          ) : (
            <div className="hg-mono text-[10.5px] text-[var(--hg-muted)] italic">
              no files yet — dispatch once to sync
            </div>
          )}
        </div>
      )}
    </div>
  );
}
