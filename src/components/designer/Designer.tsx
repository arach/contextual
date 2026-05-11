// Designer mode — a workbench for crafting context packages.
//
// The view is split across two roots:
//   - <DesignerChrome /> renders the two SidePanels into the HUD slot.
//   - <DesignerWorkbench /> renders the center-column workbench.
// Both share a `useDesignerState` hook so the active package selection is
// the single source of truth.

import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { SidePanel } from "hudsonkit/chrome";
import { Layers, Settings } from "lucide-react";

import { PACKAGES, type ContextPackage } from "@/data/packages";
import { MODULE_LIBRARY } from "@/data/modules";
import type { ContextModule } from "@/types";
import { fmtTokens, sumTokens } from "@/lib/tokens";

import { PackageList } from "@/components/designer/PackageList";
import { PackageCard } from "@/components/designer/PackageCard";
import { PackageMeta } from "@/components/designer/PackageMeta";

interface DesignerState {
  activeId: string;
  setActiveId: (id: string) => void;
  active: ContextPackage;
  modules: ContextModule[];
}

export function useDesignerState(): DesignerState {
  const [activeId, setActiveId] = useState(PACKAGES[0].id);
  const active = PACKAGES.find((p) => p.id === activeId) ?? PACKAGES[0];
  const modules = useMemo(
    () => active.modules.map((id) => MODULE_LIBRARY[id]).filter(Boolean),
    [active],
  );
  return { activeId, setActiveId, active, modules };
}

interface DesignerChromeProps {
  state: DesignerState;
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onResizeLeft: (e: MouseEvent) => void;
  onResizeRight: (e: MouseEvent) => void;
}

export function DesignerChrome({
  state,
  leftWidth,
  rightWidth,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
  onResizeLeft,
  onResizeRight,
}: DesignerChromeProps) {
  return (
    <>
      <SidePanel
        side="left"
        title="PACKAGES"
        icon={<Layers size={12} className="text-[var(--hg-accent)]" />}
        width={leftWidth}
        onResizeStart={onResizeLeft}
        isCollapsed={leftCollapsed}
        onToggleCollapse={onToggleLeft}
      >
        <PackageList
          packages={PACKAGES}
          activeId={state.activeId}
          onSelect={state.setActiveId}
        />
      </SidePanel>

      <SidePanel
        side="right"
        title="PACKAGE · META"
        icon={<Settings size={12} className="text-[var(--hg-accent)]" />}
        width={rightWidth}
        onResizeStart={onResizeRight}
        isCollapsed={rightCollapsed}
        onToggleCollapse={onToggleRight}
      >
        <PackageMeta pkg={state.active} modules={state.modules} />
      </SidePanel>
    </>
  );
}

export function DesignerWorkbench({ state }: { state: DesignerState }) {
  const { active: pkg, modules } = state;
  const totalTokens = sumTokens(modules);
  return (
    <section className="flex-1 min-w-0 flex flex-col bg-[var(--hg-bg)] overflow-auto">
      <div className="flex-shrink-0 px-9 pt-7 pb-4 border-b border-[var(--hg-line)] bg-[var(--hg-surface-2)]">
        <div className="flex items-end gap-4 mb-2">
          <h2
            contentEditable
            suppressContentEditableWarning
            className="hg-mono m-0 text-[28px] font-medium tracking-wider uppercase text-[var(--hg-ink)] leading-none border border-dashed border-transparent hover:border-[var(--hg-hairline)] focus:border-[var(--hg-accent)] focus:outline-none rounded-[2px] -mx-2 px-2 py-1 cursor-text"
          >
            {pkg.name}
          </h2>
          <span className="hg-mono text-[11px] text-[var(--hg-muted)] pb-1.5 tracking-wider uppercase">
            {pkg.version} · updated {pkg.updated}
          </span>
          <span className="ml-auto hg-mono text-[11px] text-right text-[var(--hg-muted)] leading-[1.5] tracking-wider uppercase">
            <b className="text-[var(--hg-ink)] font-medium">{modules.length}</b> cards ·{" "}
            <b className="text-[var(--hg-ink)] font-medium">{fmtTokens(totalTokens)}</b> tok
            <br />
            budget allocation ·{" "}
            <b className="text-[var(--hg-ink)] font-medium">{pkg.budget}k</b>
          </span>
        </div>

        <div
          contentEditable
          suppressContentEditableWarning
          className="text-[var(--hg-ink-2)] text-[14px] leading-[1.55] max-w-[640px] mb-1 border border-dashed border-transparent hover:border-[var(--hg-hairline)] focus:border-[var(--hg-accent)] focus:outline-none rounded-[2px] -mx-2 px-2 py-1 cursor-text"
        >
          {pkg.desc}
        </div>

        <div className="flex gap-1.5 items-center flex-wrap mt-3">
          {pkg.tags.map((t) => (
            <span key={t} className="hg-pill">
              #{t}
            </span>
          ))}
          <span className="hg-pill border-dashed cursor-pointer hover:text-[var(--hg-accent)] hover:border-[var(--hg-accent)]">
            + tag
          </span>
        </div>
      </div>

      <div className="flex-1 px-9 py-7 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 content-start">
        {modules.map((m: ContextModule) => (
          <PackageCard key={m.id} module={m} />
        ))}
        <button className="border border-dashed border-[var(--hg-hairline)] rounded-[2px] flex flex-col items-center justify-center text-[var(--hg-muted)] min-h-[220px] cursor-pointer hover:text-[var(--hg-accent)] hover:border-[var(--hg-accent)]">
          <div className="hg-mono text-[20px] mb-1">+ new card</div>
          <div className="hg-mono text-[10px] tracking-[0.14em] uppercase">drop · paste · type</div>
        </button>
      </div>
    </section>
  );
}
