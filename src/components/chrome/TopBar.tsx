// Wraps Hudson's NavigationBar with the Hangar callsign brand, the mode
// pill (session/designer), and the shortcut/meta actions.
import { NavigationBar } from "hudsonkit/chrome";
import type { AppMode } from "@/App";
import { BrandMark } from "@/components/chrome/BrandMark";
import { TopBarActions } from "@/components/chrome/TopBarActions";
import { ModeSwitch } from "@/components/chrome/ModeSwitch";

interface TopBarProps {
  mode: AppMode;
  onModeChange: (m: AppMode) => void;
  threadName: string;
  activeBranch: string;
  threadCount: number;
}

export function TopBar({ mode, onModeChange, threadName, activeBranch, threadCount }: TopBarProps) {
  return (
    <NavigationBar
      title="CONTEXTUAL"
      subtitle={
        mode === "session" ? (
          <span className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)]">
            / {threadName}
            <span className="text-[var(--hg-hairline)] mx-1">·</span>
            {activeBranch}
          </span>
        ) : (
          <span className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)]">
            / designer
          </span>
        )
      }
      center={
        <div className="flex items-center gap-4">
          <BrandMark />
          <ModeSwitch mode={mode} onChange={onModeChange} />
        </div>
      }
      actions={<TopBarActions threadCount={threadCount} />}
    />
  );
}
