// Builds the live command list for the ⌘K palette. Each entry knows how to
// fire itself against the current thread store + UI state.

import { useMemo } from "react";
import type { CommandOption } from "hudsonkit/overlays";
import type { ThreadStore } from "@/state/useThreadStore";

export interface ShellActions {
  toggleLeft: () => void;
  toggleRight: () => void;
  openDesigner: () => void;
  openSession: () => void;
  openTree: () => void;
}

export function useCommands(store: ThreadStore, shell: ShellActions): CommandOption[] {
  return useMemo<CommandOption[]>(() => {
    const cmds: CommandOption[] = [];

    // --- thread switching ---
    for (const t of store.threads) {
      cmds.push({
        id: `thread:${t.id}`,
        label: `Switch to ${t.name}`,
        shortcut: t.id === store.activeId ? "active" : undefined,
        action: () => store.select(t.id),
      });
    }

    // --- thread actions ---
    cmds.push(
      {
        id: "thread:branch",
        label: "Branch this thread",
        shortcut: "⌘B",
        action: store.branch,
      },
      {
        id: "thread:archive",
        label: "Archive this thread",
        action: () => alert("(proto) archive not wired"),
      },
      {
        id: "thread:summarize",
        label: "Summarize now",
        action: () => alert("(proto) summarize triggered"),
      },
    );

    // --- rack actions: pin newest soft to fixed ---
    const newestSoft = [...store.active.soft].reverse().find((s) => s.kind === "turn");
    if (newestSoft) {
      cmds.push({
        id: "rack:pin-newest",
        label: `Pin newest turn → fixed (${newestSoft.title})`,
        action: () => store.pinSoft(newestSoft.id),
      });
    }

    // --- shell ---
    cmds.push(
      {
        id: "shell:toggle-left",
        label: "Toggle threads panel",
        shortcut: "⌘[",
        action: shell.toggleLeft,
      },
      {
        id: "shell:toggle-right",
        label: "Toggle context rack",
        shortcut: "⌘]",
        action: shell.toggleRight,
      },
      {
        id: "shell:open-session",
        label: "Open Session view",
        action: shell.openSession,
      },
      {
        id: "shell:open-designer",
        label: "Open Designer view",
        action: shell.openDesigner,
      },
      {
        id: "shell:open-tree",
        label: "Open /tree (pi session forest)",
        shortcut: "⌘T",
        action: shell.openTree,
      },
    );

    return cmds;
  }, [store, shell]);
}
