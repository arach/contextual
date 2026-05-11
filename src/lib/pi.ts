// Client for the dev-server pi shim. The plugin owns session-path
// bookkeeping; callers only need to send (threadId, branchId) plus a prompt.
//
// Three operations:
//   dispatchPi   — send a user message; pi replies in-session
//   branchPi     — record a pending fork from one branch to another
//   fetchPiTree  — read the session tree for visualization

import type { Thread } from "@/types";
import { MODULE_LIBRARY } from "@/data/modules";
import { decaySoft } from "@/lib/derive";

const DEFAULT_SYSTEM = [
  "You are a senior product designer collaborating with the user inside a",
  "design tool called Contextual.",
  "Respond in 2–4 short sentences. No emoji. Be concrete and a little",
  "opinionated.",
].join(" ");

/** Build the user-facing prompt — Fixed/Soft context lives on pi's side via
 *  the session file, so this is just the user's new message plus the slice
 *  of context that pi wouldn't otherwise have (Fixed modules, task). */
export function buildThreadPrompt(thread: Thread, userText: string): string {
  const fixed = thread.fixed
    .map((id) => MODULE_LIBRARY[id])
    .filter(Boolean)
    .map((m) => `[fixed:${m.kind}] ${m.name}\n${m.body}`)
    .join("\n\n");

  // Only include summaries + recent turns when this is the very first
  // dispatch of a branch (the session has nothing yet). After that pi's
  // session carries them automatically.
  const summaries = thread.soft
    .filter((s) => s.kind === "summary")
    .map((s) => `[summary] ${s.body}`)
    .join("\n");

  const recent = decaySoft(thread)
    .filter((d) => !d.evicted && d.item.kind === "turn")
    .map((d) => {
      const it = d.item as Extract<typeof d.item, { kind: "turn" }>;
      return `${it.role}: ${it.body}`;
    })
    .join("\n");

  return [
    "FIXED CONTEXT:",
    fixed,
    "",
    summaries && "EARLIER SUMMARIES:",
    summaries,
    "",
    recent && "RECENT TURNS:",
    recent,
    "",
    `CURRENT TASK: ${thread.task?.body ?? "(none)"}`,
    "",
    `USER (just now): ${userText}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface DispatchResult {
  reply: string;
  sessionPath: string;
  forked: boolean;
}

export async function dispatchPi(
  threadId: string,
  branchId: string,
  prompt: string,
  systemPrompt: string = DEFAULT_SYSTEM,
): Promise<DispatchResult> {
  const res = await fetch("/api/pi/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId, branchId, prompt, systemPrompt }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(data.error ?? `pi call failed: ${res.status}`);
  }
  return (await res.json()) as DispatchResult;
}

export async function branchPi(
  threadId: string,
  fromBranchId: string,
  newBranchId: string,
): Promise<{ forkFrom: string | null; pending: boolean }> {
  const res = await fetch("/api/pi/branch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId, fromBranchId, newBranchId }),
  });
  if (!res.ok) throw new Error(`branch failed: ${res.status}`);
  return (await res.json()) as { forkFrom: string | null; pending: boolean };
}

// ---- Tree types -----------------------------------------------------------

export interface PiSessionSummary {
  path: string;
  id: string;
  cwd: string;
  parentSession?: string;
  messageCount: number;
  userCount: number;
  assistantCount: number;
  firstUserText?: string;
  lastTimestamp: string;
  totalTokens: number;
  totalCost: number;
}

export interface PiTreeResponse {
  sessions: PiSessionSummary[];
  branches: Record<string, { sessionPath: string | null; forkFrom?: string | null }>;
}

export async function fetchPiTree(): Promise<PiTreeResponse> {
  const res = await fetch("/api/pi/tree");
  if (!res.ok) throw new Error(`tree fetch failed: ${res.status}`);
  return (await res.json()) as PiTreeResponse;
}
