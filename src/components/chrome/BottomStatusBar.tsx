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
      status={{ label: "ready", color: "neutral" }}
      left={
        <div className="flex items-center gap-3 font-mono text-[12px]">
          <span className="text-neutral-500">thread</span>
          <span className="text-neutral-100 uppercase tracking-wider">
            {threadId}/{branchName}
          </span>
          <span className="h-3 w-px bg-neutral-700" />
          <span className="text-neutral-500">turn</span>
          <span className="text-neutral-100">{turn}</span>
        </div>
      }
      right={
        <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-500">
          <span>fix {fmtTokens(fixedTokens)}</span>
          <span>soft {fmtTokens(softTokens)}</span>
          <span>free {fmtTokens(free)}</span>
        </div>
      }
    />
  );
}
