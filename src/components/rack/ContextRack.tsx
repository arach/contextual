// Right rail — the context rack. Header carries three semicircle gauges + a
// fuel bar; body lists the active task, Fixed modules, and Soft items with
// budget-aware eviction. Per-thread budget sliders sit at each zone header.
import { useState } from "react";
import type { MouseEvent } from "react";
import { SidePanel } from "hudsonkit/chrome";
import { Gauge } from "@/components/rack/Gauge";
import { FuelBar } from "@/components/rack/FuelBar";
import { BudgetSlider } from "@/components/rack/BudgetSlider";
import { RackZone } from "@/components/rack/RackZone";
import { RackCard } from "@/components/rack/RackCard";
import { WorkspaceBadge } from "@/components/rack/WorkspaceBadge";
import type { Thread } from "@/types";
import { fmtTokens, sumTokens } from "@/lib/tokens";
import { decaySoft, resolveFixed } from "@/lib/derive";

interface ContextRackProps {
  thread: Thread;
  isCollapsed: boolean;
  width: number;
  /** Bumps when a dispatch may have changed the workspace on disk. */
  syncTick: number;
  onResizeStart: (e: MouseEvent) => void;
  onToggleCollapse: () => void;
  onSetFixedBudget: (v: number) => void;
  onSetSoftKeep: (v: number) => void;
  onPin: (softId: string) => void;
  onUnpin: (moduleId: string) => void;
  onDrop: (id: string, zone: "fixed" | "soft") => void;
}

export function ContextRack({
  thread,
  isCollapsed,
  width,
  syncTick,
  onResizeStart,
  onToggleCollapse,
  onSetFixedBudget,
  onSetSoftKeep,
  onPin,
  onUnpin,
  onDrop,
}: ContextRackProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded((p) => (p === id ? null : id));

  const fixed = resolveFixed(thread);
  const decayed = decaySoft(thread);
  const liveSoft = decayed.filter((d) => !d.evicted);
  const evictedCount = decayed.length - liveSoft.length;

  const fixedTokens = sumTokens(fixed);
  const fixedBudgetTokens = thread.fixedBudget * 1000;
  const fixedOverBudget = fixedTokens > fixedBudgetTokens;
  const softTokens = sumTokens(liveSoft.map((d) => d.item)) + (thread.task?.tokens ?? 0);
  const softBudgetTokens = (100 - thread.fixedBudget) * 1000;
  const total = fixedTokens + softTokens;

  return (
    <SidePanel
      side="right"
      title="CONTEXT RACK"
      width={width}
      onResizeStart={onResizeStart}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      headerActions={
        <div className="flex items-center gap-2">
          <WorkspaceBadge threadId={thread.id} syncTick={syncTick} />
          <span className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)]">
            {fmtTokens(total)} · {thread.name}/{thread.activeBranch}
          </span>
        </div>
      }
    >
      <div className="px-4 pt-3 pb-2 border-b border-[var(--hg-line)]">
        <div className="relative grid grid-cols-3 gap-2 p-2.5 border border-dashed border-[var(--hg-hairline)] rounded-[2px]">
          <span className="absolute -top-2 left-3 px-1.5 bg-[var(--hg-surface)] hg-mono text-[9px] tracking-wider uppercase text-[var(--hg-muted)]">
            budget · 100k tokens
          </span>
          <Gauge value={fixedTokens} max={fixedBudgetTokens} label="fixed" color="var(--hg-ink)" />
          <Gauge value={softTokens} max={softBudgetTokens} label="soft" color="var(--hg-accent)" />
          <Gauge value={total} max={100000} label="total" color="var(--hg-accent-deep)" />
        </div>
        <FuelBar fixedTokens={fixedTokens} softTokens={softTokens} />
      </div>

      <div className="px-3 pt-2 pb-4 overflow-auto">
        {thread.task && (
          <section className="mb-4">
            <RackZone label="now" sublabel="current task" meta="always present" />
            <RackCard
              item={{ source: "task", task: thread.task }}
              expanded={expanded === thread.task.id}
              onExpand={() => toggle(thread.task!.id)}
            />
          </section>
        )}

        <section className="mb-4">
          <RackZone
            label="fixed"
            sublabel="pinned to every call"
            meta={
              <>
                {fixed.length} cards · {fmtTokens(fixedTokens)}
                {fixedOverBudget && <span className="text-[var(--hg-warn)]"> · over</span>}
              </>
            }
          />
          <BudgetSlider
            label="budget"
            value={thread.fixedBudget}
            min={5}
            max={60}
            display={`${thread.fixedBudget}k`}
            onChange={onSetFixedBudget}
          />
          {fixed.map((m) => (
            <RackCard
              key={m.id}
              item={{ source: "fixed", module: m }}
              expanded={expanded === m.id}
              onExpand={() => toggle(m.id)}
              onUnpin={() => onUnpin(m.id)}
              onDrop={() => onDrop(m.id, "fixed")}
            />
          ))}
          {fixed.length === 0 && (
            <div className="px-3 py-3 text-center hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)]">
              pin a soft card to fix it here
            </div>
          )}
        </section>

        <section className="mb-4">
          <RackZone
            label="soft"
            sublabel="recent + summaries"
            meta={
              <>
                keep {thread.softKeep} turns · {fmtTokens(softTokens)}
              </>
            }
          />
          <BudgetSlider
            label="keep recent"
            value={thread.softKeep}
            min={2}
            max={20}
            display={`${thread.softKeep} turns`}
            onChange={onSetSoftKeep}
          />
          {decayed.map((d) => (
            <RackCard
              key={d.item.id}
              item={{ source: "soft", soft: d.item }}
              evicted={d.evicted}
              expanded={expanded === d.item.id}
              onExpand={() => toggle(d.item.id)}
              onPin={() => onPin(d.item.id)}
              onDrop={() => onDrop(d.item.id, "soft")}
            />
          ))}
        </section>

        {evictedCount > 0 && (
          <div className="px-2 py-2 text-center hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-muted)]">
            {evictedCount} item{evictedCount > 1 ? "s" : ""} evicted by budget. raise{" "}
            <b className="text-[var(--hg-ink)] font-medium">keep recent</b> to restore.
          </div>
        )}
      </div>
    </SidePanel>
  );
}
