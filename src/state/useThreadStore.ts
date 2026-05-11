// Single source of truth for thread state. A reducer keeps mutations explicit
// (and easy to test) — every interaction in the UI maps to exactly one action.

import { useCallback, useMemo, useReducer } from "react";
import type { ContextModule, SoftItem, Thread } from "@/types";
import { MODULE_LIBRARY } from "@/data/modules";
import { initialThreads } from "@/data/threads";
import { tokFor } from "@/lib/tokens";

interface State {
  threads: Thread[];
  activeId: string;
}

type Action =
  | { type: "select"; id: string }
  | { type: "setComposer"; v: string }
  | { type: "setActiveBranch"; v: string }
  | { type: "branch" }
  | { type: "setFixedBudget"; v: number }
  | { type: "setSoftKeep"; v: number }
  | { type: "pinSoft"; id: string }
  | { type: "unpinFixed"; moduleId: string }
  | { type: "drop"; id: string; zone: "fixed" | "soft" }
  | { type: "appendSoft"; item: SoftItem; bumpTurn?: boolean };

const initialState: State = {
  threads: initialThreads,
  activeId: "design",
};

function patchActive(state: State, patch: Partial<Thread> | ((t: Thread) => Partial<Thread>)): State {
  return {
    ...state,
    threads: state.threads.map((t) =>
      t.id === state.activeId ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t,
    ),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select":
      return { ...state, activeId: action.id };

    case "setComposer":
      return patchActive(state, { composer: action.v });

    case "setActiveBranch":
      return patchActive(state, { activeBranch: action.v });

    case "branch":
      return patchActive(state, (t) => {
        const name = `branch-${t.branches.length}`;
        return { branches: [...t.branches, name], activeBranch: name };
      });

    case "setFixedBudget":
      return patchActive(state, { fixedBudget: action.v });

    case "setSoftKeep":
      return patchActive(state, { softKeep: action.v });

    case "pinSoft":
      return patchActive(state, (t) => {
        const item = t.soft.find((s) => s.id === action.id);
        if (!item) return {};
        // Synthesize a module so the rest of the system can address it by id.
        const moduleId = `pin-${item.id}`;
        const promoted: ContextModule = {
          id: moduleId,
          name: item.title || `pinned · ${item.id}`,
          kind: item.kind === "summary" ? "log" : item.kind === "tool" ? "doc" : "rules",
          tokens: item.tokens,
          body: item.body,
        };
        MODULE_LIBRARY[moduleId] = promoted;
        return {
          fixed: [...t.fixed, moduleId],
          soft: t.soft.filter((s) => s.id !== action.id),
        };
      });

    case "unpinFixed":
      return patchActive(state, (t) => {
        const m = MODULE_LIBRARY[action.moduleId];
        if (!m) return { fixed: t.fixed.filter((id) => id !== action.moduleId) };
        const restored: SoftItem = {
          id: `u-${action.moduleId}`,
          kind: "turn",
          role: "model",
          age: "now",
          tokens: m.tokens,
          title: `unpinned · ${m.name}`,
          body: m.body,
        };
        return {
          fixed: t.fixed.filter((id) => id !== action.moduleId),
          soft: [...t.soft, restored],
        };
      });

    case "drop":
      return patchActive(state, (t) =>
        action.zone === "fixed"
          ? { fixed: t.fixed.filter((id) => id !== action.id) }
          : { soft: t.soft.filter((s) => s.id !== action.id) },
      );

    case "appendSoft":
      return patchActive(state, (t) => ({
        soft: [...t.soft, action.item],
        composer: "",
        turn: action.bumpTurn ? t.turn + 1 : t.turn,
      }));

    default:
      return state;
  }
}

export interface ThreadStore {
  threads: Thread[];
  active: Thread;
  activeId: string;
  select: (id: string) => void;
  setComposer: (v: string) => void;
  setActiveBranch: (v: string) => void;
  branch: () => void;
  setFixedBudget: (v: number) => void;
  setSoftKeep: (v: number) => void;
  pinSoft: (id: string) => void;
  unpinFixed: (moduleId: string) => void;
  drop: (id: string, zone: "fixed" | "soft") => void;
  /** Append a user turn locally; returns the prompt text that was sent. */
  sendUserMessage: () => string | null;
  /** Append a model response after async work completes. */
  appendModelReply: (body: string) => void;
}

export function useThreadStore(): ThreadStore {
  const [state, dispatch] = useReducer(reducer, initialState);
  const active = useMemo(
    () => state.threads.find((t) => t.id === state.activeId) ?? state.threads[0],
    [state.threads, state.activeId],
  );

  const select = useCallback((id: string) => dispatch({ type: "select", id }), []);
  const setComposer = useCallback((v: string) => dispatch({ type: "setComposer", v }), []);
  const setActiveBranch = useCallback((v: string) => dispatch({ type: "setActiveBranch", v }), []);
  const branch = useCallback(() => dispatch({ type: "branch" }), []);
  const setFixedBudget = useCallback((v: number) => dispatch({ type: "setFixedBudget", v }), []);
  const setSoftKeep = useCallback((v: number) => dispatch({ type: "setSoftKeep", v }), []);
  const pinSoft = useCallback((id: string) => dispatch({ type: "pinSoft", id }), []);
  const unpinFixed = useCallback((moduleId: string) => dispatch({ type: "unpinFixed", moduleId }), []);
  const drop = useCallback(
    (id: string, zone: "fixed" | "soft") => dispatch({ type: "drop", id, zone }),
    [],
  );

  const sendUserMessage = useCallback((): string | null => {
    const text = active.composer.trim();
    if (!text) return null;
    const item: SoftItem = {
      id: `u-${Date.now()}`,
      kind: "turn",
      role: "user",
      age: "just now",
      tokens: tokFor(text),
      title: "user · just now",
      body: text,
    };
    dispatch({ type: "appendSoft", item, bumpTurn: true });
    return text;
  }, [active.composer]);

  const appendModelReply = useCallback((body: string) => {
    const item: SoftItem = {
      id: `m-${Date.now()}`,
      kind: "turn",
      role: "model",
      age: "just now",
      tokens: tokFor(body),
      title: "model · just now",
      body: body.trim(),
    };
    dispatch({ type: "appendSoft", item });
  }, []);

  return {
    threads: state.threads,
    active,
    activeId: state.activeId,
    select,
    setComposer,
    setActiveBranch,
    branch,
    setFixedBudget,
    setSoftKeep,
    pinSoft,
    unpinFixed,
    drop,
    sendUserMessage,
    appendModelReply,
  };
}
