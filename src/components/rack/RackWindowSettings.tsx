import { useState } from "react";
import { BudgetSlider } from "@/components/rack/BudgetSlider";

interface RackWindowSettingsProps {
  fixedBudget: number;
  softKeep: number;
  onSetFixedBudget: (v: number) => void;
  onSetSoftKeep: (v: number) => void;
}

export function RackWindowSettings({
  fixedBudget,
  softKeep,
  onSetFixedBudget,
  onSetSoftKeep,
}: RackWindowSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative px-4 py-2 border-b border-[var(--hg-line)]">
      <button
        type="button"
        className="text-[11px] text-neutral-600 hover:text-neutral-400"
        onClick={() => setOpen((o) => !o)}
      >
        Window settings {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="mt-2 space-y-1 pb-1">
          <BudgetSlider
            label="fixed budget"
            value={fixedBudget}
            min={5}
            max={60}
            display={`${fixedBudget}k`}
            onChange={onSetFixedBudget}
          />
          <BudgetSlider
            label="keep turns"
            value={softKeep}
            min={2}
            max={20}
            display={`${softKeep}`}
            onChange={onSetSoftKeep}
          />
        </div>
      )}
    </div>
  );
}
