// A semicircle "console" gauge — SVG arc with a needle. Goes red over budget.
import { fmtTokens } from "@/lib/tokens";

interface GaugeProps {
  value: number;
  max: number;
  label: string;
  color?: string;
}

const ARC_LENGTH = 87.96;

export function Gauge({ value, max, label, color = "var(--hg-ink)" }: GaugeProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const angle = -90 + pct * 180;
  const R = 28;
  const cx = 36;
  const cy = 36;
  const tx = cx + R * Math.cos((angle * Math.PI) / 180);
  const ty = cy + R * Math.sin((angle * Math.PI) / 180);
  const overBudget = value > max;
  const stroke = overBudget ? "var(--hg-warn)" : color;
  return (
    <div className="flex flex-col items-center gap-0.5 p-1">
      <svg width="72" height="44" viewBox="0 0 72 44">
        <path
          d="M 8 36 A 28 28 0 0 1 64 36"
          stroke="var(--hg-hairline)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 8 36 A 28 28 0 0 1 64 36"
          stroke={stroke}
          strokeWidth="4"
          fill="none"
          strokeDasharray={`${pct * ARC_LENGTH} ${ARC_LENGTH}`}
          strokeLinecap="round"
        />
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="var(--hg-ink)" strokeWidth="1.2" />
        <circle cx={cx} cy={cy} r="2" fill="var(--hg-ink)" />
      </svg>
      <div className="hg-mono text-[18px] leading-none text-[var(--hg-ink)] mt-0.5">
        {fmtTokens(value)}
      </div>
      <div className="hg-mono text-[9.5px] tracking-wider uppercase text-[var(--hg-muted)]">
        {label} · {fmtTokens(max)}
      </div>
    </div>
  );
}
