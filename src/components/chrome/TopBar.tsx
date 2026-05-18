// Hudson NavigationBar — Scout-style mode tabs and backend chip.
import { NavigationBar } from "hudsonkit/chrome";
import type { AppMode } from "@/App";
import type { BackendConfig } from "@/types";
import { BackendChip } from "@/components/chrome/BackendChip";
import { TopBarActions } from "@/components/chrome/TopBarActions";
import { ModeSwitch } from "@/components/chrome/ModeSwitch";

interface TopBarProps {
  mode: AppMode;
  onModeChange: (m: AppMode) => void;
  threadName: string;
  activeBranch: string;
  threadCount: number;
  backendConfig: BackendConfig;
  onBackendChange: (next: BackendConfig) => void;
}

export function TopBar({
  mode,
  onModeChange,
  threadName,
  activeBranch,
  threadCount,
  backendConfig,
  onBackendChange,
}: TopBarProps) {
  return (
    <NavigationBar
      title="Context"
      subtitle={
        mode === "session" ? (
          <span className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)]">
            / {threadName}
            <span className="text-[var(--hg-hairline)] mx-1">·</span>
            {activeBranch}
          </span>
        ) : mode === "designer" ? (
          <span className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)]">
            / packages
          </span>
        ) : (
          <span className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)]">
            / explore
          </span>
        )
      }
      center={
        <div className="flex items-center gap-4">
          <ModeSwitch mode={mode} onChange={onModeChange} />
          {mode === "session" && (
            <BackendChip value={backendConfig} onChange={onBackendChange} />
          )}
        </div>
      }
      actions={<TopBarActions threadCount={threadCount} />}
    />
  );
}
