// Hudson's StatusBar holds the always-visible live numbers: which thread is
// active, how loaded the context is, what fraction of budget is free.
import { StatusBar } from "hudsonkit/chrome";
import { fmtTokens } from "@/lib/tokens";
import { TOTAL_BUDGET } from "@/types";

interface BottomStatusBarProps {
  threadId: string;
  branchName: string;
  turn: number;
  fixedTokens: number;
  softTokens: number;
}

export function BottomStatusBar({
  threadId,
  branchName,
  turn,
  fixedTokens,
  softTokens,
}: BottomStatusBarProps) {
  const total = fixedTokens + softTokens;
  const free = Math.max(0, TOTAL_BUDGET - total);
  return (
    <StatusBar
      status={{ label: "ONLINE", color: "emerald" }}
      left={
        <div className="flex items-center gap-3 hg-mono text-[10.5px]">
          <span className="text-[var(--hg-muted)]">thread</span>
          <span className="text-[var(--hg-ink)] uppercase tracking-wider">
            {threadId}/{branchName}
          </span>
          <span className="text-[var(--hg-hairline)]">·</span>
          <span className="text-[var(--hg-muted)]">turn</span>
          <span className="text-[var(--hg-ink)]">{turn}</span>
        </div>
      }
      right={
        <div className="flex items-center gap-3 hg-mono text-[10.5px]">
          <span className="text-[var(--hg-muted)]">fix</span>
          <span className="text-[var(--hg-ink)]">{fmtTokens(fixedTokens)}</span>
          <span className="text-[var(--hg-muted)]">soft</span>
          <span className="text-[var(--hg-accent)]">{fmtTokens(softTokens)}</span>
          <span className="text-[var(--hg-muted)]">free</span>
          <span className="text-[var(--hg-ink)]">{fmtTokens(free)}</span>
        </div>
      }
    />
  );
}
