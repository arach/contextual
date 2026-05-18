// A range input dressed up to match the Hangar aesthetic.
interface BudgetSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  display: string;
  onChange: (v: number) => void;
}

export function BudgetSlider({ label, value, min, max, display, onChange }: BudgetSliderProps) {
  return (
    <div className="px-1.5 py-1.5 flex items-center gap-2.5 font-mono text-[10px] text-neutral-600 tracking-wide">
      <span className="uppercase">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: "var(--ctx-accent-deep)" }}
        className="flex-1 h-2 opacity-80"
      />
      <span className="text-neutral-400 min-w-[56px] text-right tabular-nums">{display}</span>
    </div>
  );
}
