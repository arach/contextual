// Client for the dev-server pi shim. The plugin owns session paths AND now
// materializes Fixed modules as files (AGENTS.md + .pi/skills/*.md) inside a
// per-thread workspace dir that pi runs from. So dispatch no longer needs to
// stuff the full module library into the prompt — only the user message and
// the live task.

import type { Thread } from "@/types";
import { MODULE_LIBRARY } from "@/data/modules";

const DEFAULT_SYSTEM = [
  "You are a senior product designer collaborating with the user inside a",
  "design tool called Contextual.",
  "Respond in 2–4 short sentences. No emoji. Be concrete and a little",
  "opinionated.",
].join(" ");

interface FixedPayload {
  id: string;
  name: string;
  kind: "rules" | "doc" | "log";
  body: string;
}

function fixedFor(thread: Thread): FixedPayload[] {
  return thread.fixed
    .map((id) => MODULE_LIBRARY[id])
    .filter(Boolean)
    .map((m) => ({ id: m.id, name: m.name, kind: m.kind, body: m.body }));
}

export interface DispatchResult {
  reply: string;
  sessionPath: string;
  forked: boolean;
  workspaceDir: string;
  files: { relpath: string; bytes: number }[];
}

export async function dispatchPi(
  thread: Thread,
  userText: string,
  systemPrompt: string = DEFAULT_SYSTEM,
): Promise<DispatchResult> {
  const res = await fetch("/api/pi/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      threadId: thread.id,
      branchId: thread.activeBranch,
      prompt: userText,
      task: thread.task?.body,
      fixed: fixedFor(thread),
      systemPrompt,
    }),
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

// ---- Tree -----------------------------------------------------------------

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

// ---- Workspace introspection ---------------------------------------------

export interface WorkspaceFile {
  relpath: string;
  bytes: number;
}

export interface PiWorkspaceResponse {
  workspaceDir: string;
  files: WorkspaceFile[];
}

export async function fetchPiWorkspace(threadId: string): Promise<PiWorkspaceResponse> {
  const res = await fetch(`/api/pi/workspace?threadId=${encodeURIComponent(threadId)}`);
  if (!res.ok) throw new Error(`workspace fetch failed: ${res.status}`);
  return (await res.json()) as PiWorkspaceResponse;
}
