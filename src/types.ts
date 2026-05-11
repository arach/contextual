// Domain types for the Contextual prototype.
//
// The mental model is:
//   - Each Thread holds its own Fixed and Soft contexts plus budgets, branches,
//     composer draft, and conversation history (Soft items are the conversation).
//   - Every LLM call is composed fresh from Fixed modules + a windowed slice of
//     Soft items + the live task + the composer draft.

export type ModuleKind = "rules" | "doc" | "log";

/** A reusable, named chunk of context that can be pinned into Fixed. */
export interface ContextModule {
  id: string;
  name: string;
  kind: ModuleKind;
  tokens: number;
  body: string;
}

/** A library indexed by module id. Fixed slots reference these by id. */
export type ModuleLibrary = Record<string, ContextModule>;

export type SoftKind = "summary" | "turn" | "tool" | "task";
export type TurnRole = "user" | "model";

/** A heterogeneous item that lives in the Soft zone of a thread. */
export type SoftItem =
  | {
      id: string;
      kind: "summary";
      age: string;
      tokens: number;
      title: string;
      body: string;
    }
  | {
      id: string;
      kind: "turn";
      role: TurnRole;
      age: string;
      tokens: number;
      title: string;
      body: string;
    }
  | {
      id: string;
      kind: "tool";
      age: string;
      tokens: number;
      title: string;
      body: string;
    };

/** The "current task" — sticky, always-present soft item. */
export interface ThreadTask {
  id: string;
  kind: "task";
  age: string;
  tokens: number;
  title: string;
  body: string;
  sticky: true;
}

export type ThreadStatus = "live" | "idle" | "archived";

export interface Thread {
  id: string;
  name: string;
  glyph: string;
  lastActive: string;
  status: ThreadStatus;
  branches: string[];
  activeBranch: string;
  /** Fixed module ids resolved against the ModuleLibrary. */
  fixed: string[];
  /** Soft items in chronological order — newest at the end. */
  soft: SoftItem[];
  task: ThreadTask | null;
  composer: string;
  turn: number;
  /** Budget allocated to Fixed, in thousands of tokens (e.g. 35 = 35k). */
  fixedBudget: number;
  /** Number of recent soft turns to keep in-window. */
  softKeep: number;
}

/** Hard cap on the model's context window for this prototype. */
export const TOTAL_BUDGET = 100_000;
