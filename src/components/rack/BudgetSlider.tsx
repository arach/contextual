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
    <div className="px-1.5 py-2 flex items-center gap-2.5 hg-mono text-[10.5px] text-[var(--hg-muted)] tracking-wider uppercase">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: "var(--hg-accent)" }}
        className="flex-1 h-3.5"
      />
      <span className="text-[var(--hg-ink)] min-w-[56px] text-right">{display}</span>
    </div>
  );
}
