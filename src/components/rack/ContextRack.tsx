import { useState } from "react";
import type { MouseEvent } from "react";
import { SidePanel } from "hudsonkit/chrome";
import { RackBudgetStrip } from "@/components/rack/RackBudgetStrip";
import { RackSection } from "@/components/rack/RackSection";
import { RackWindowSettings } from "@/components/rack/RackWindowSettings";
import { RackCard } from "@/components/rack/RackCard";
import { CostChip } from "@/components/rack/CostChip";
import { WorkspaceBadge } from "@/components/rack/WorkspaceBadge";
import type { Thread } from "@/types";
import { fmtTokens, sumTokens } from "@/lib/tokens";
import { decaySoft, resolveFixed } from "@/lib/derive";

interface ContextRackProps {
  thread: Thread;
  isCollapsed: boolean;
  width: number;
  syncTick: number;
  onResizeStart: (e: MouseEvent) => void;
  onToggleCollapse: () => void;
  onSetFixedBudget: (v: number) => void;
  onSetSoftKeep: (v: number) => void;
  onPin: (softId: string) => void;
  onUnpin: (moduleId: string) => void;
  onDrop: (id: string, zone: "fixed" | "soft") => void;
}

export function ContextRackContent({
  thread,
  syncTick,
  onSetFixedBudget,
  onSetSoftKeep,
  onPin,
  onUnpin,
  onDrop,
}: {
  thread: Thread;
  syncTick: number;
  onSetFixedBudget: (v: number) => void;
  onSetSoftKeep: (v: number) => void;
  onPin: (softId: string) => void;
  onUnpin: (moduleId: string) => void;
  onDrop: (id: string, zone: "fixed" | "soft") => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({
    task: true,
    fixed: true,
    soft: false,
  });
  const toggle = (id: string) => setExpanded((p) => (p === id ? null : id));
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const fixed = resolveFixed(thread);
  const decayed = decaySoft(thread);
  const liveSoft = decayed.filter((d) => !d.evicted);
  const evictedCount = decayed.length - liveSoft.length;

  const fixedTokens = sumTokens(fixed);
  const fixedBudgetTokens = thread.fixedBudget * 1000;
  const softTokens = sumTokens(liveSoft.map((d) => d.item)) + (thread.task?.tokens ?? 0);
  const softBudgetTokens = (100 - thread.fixedBudget) * 1000;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-[var(--hg-line)] px-2 py-1.5">
        {thread.backendConfig.backend === "pi-coding-agent" ? (
          <WorkspaceBadge threadId={thread.id} syncTick={syncTick} />
        ) : (
          thread.lastUsage && <CostChip usage={thread.lastUsage} />
        )}
      </div>
      <RackBudgetStrip
        fixedTokens={fixedTokens}
        softTokens={softTokens}
        fixedBudgetTokens={fixedBudgetTokens}
        softBudgetTokens={softBudgetTokens}
      />
      <RackWindowSettings
        fixedBudget={thread.fixedBudget}
        softKeep={thread.softKeep}
        onSetFixedBudget={onSetFixedBudget}
        onSetSoftKeep={onSetSoftKeep}
      />
      <div className="flex-1 overflow-auto px-2 pb-4 pt-1">
        {thread.task && (
          <RackSection
            title="Task"
            summary={thread.task.title}
            open={openSections.task}
            onToggle={() => toggleSection("task")}
          >
            <RackCard
              item={{ source: "task", task: thread.task }}
              expanded={expanded === thread.task.id}
              onExpand={() => toggle(thread.task!.id)}
            />
          </RackSection>
        )}

        <RackSection
          title="Fixed"
          summary={`${fixed.length} · ${fmtTokens(fixedTokens)}`}
          open={openSections.fixed}
          onToggle={() => toggleSection("fixed")}
        >
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
            <p className="px-3 py-2 text-[11px] text-neutral-600">Nothing pinned yet.</p>
          )}
        </RackSection>

        <RackSection
          title="In window"
          summary={`${liveSoft.length} · ${fmtTokens(softTokens)}`}
          open={openSections.soft}
          onToggle={() => toggleSection("soft")}
        >
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
        </RackSection>

        {evictedCount > 0 && (
          <p className="px-3 py-2 text-[11px] text-neutral-600">
            {evictedCount} older item{evictedCount > 1 ? "s" : ""} out of window. Increase keep
            turns in settings to restore.
          </p>
        )}
      </div>
    </div>
  );
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
  return (
    <SidePanel
      side="right"
      title="Context"
      width={width}
      onResizeStart={onResizeStart}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      headerActions={
        <div className="flex items-center gap-2">
          {thread.backendConfig.backend === "pi-coding-agent" ? (
            <WorkspaceBadge threadId={thread.id} syncTick={syncTick} />
          ) : (
            thread.lastUsage && <CostChip usage={thread.lastUsage} />
          )}
        </div>
      }
    >
      <ContextRackContent
        thread={thread}
        syncTick={syncTick}
        onSetFixedBudget={onSetFixedBudget}
        onSetSoftKeep={onSetSoftKeep}
        onPin={onPin}
        onUnpin={onUnpin}
        onDrop={onDrop}
      />
    </SidePanel>
  );
}
