// Browser-side client for the backends Vite plugin. The plugin lives in
// /vite-plugin-backends.ts; this file shapes fetch calls against its routes.

import type { Thread } from "@/types";
import { MODULE_LIBRARY } from "@/data/modules";
import type {
  BranchRequest,
  DispatchRequest,
  DispatchResult,
} from "./types";

const DEFAULT_SYSTEM = [
  "You are a senior product designer collaborating with the user inside a",
  "design tool called Contextual.",
  "Respond in 2–4 short sentences. No emoji. Be concrete and a little",
  "opinionated.",
].join(" ");

function fixedFor(thread: Thread) {
  return thread.fixed
    .map((id) => MODULE_LIBRARY[id])
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
}

export async function dispatch(
  thread: Thread,
  userText: string,
  systemPrompt: string = DEFAULT_SYSTEM,
): Promise<DispatchResult> {
  const body: DispatchRequest = {
    threadId: thread.id,
    branchId: thread.activeBranch,
    fixed: fixedFor(thread),
    soft: thread.soft,
    task: thread.task,
    user: userText,
    systemPrompt,
    config: thread.backendConfig,
  };
  const res = await fetch("/api/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(data.error ?? `dispatch failed: ${res.status}`);
  }
  return (await res.json()) as DispatchResult;
}

export async function branch(
  thread: Thread,
  fromBranchId: string,
  newBranchId: string,
): Promise<{ pending: boolean }> {
  const body: BranchRequest = {
    threadId: thread.id,
    fromBranchId,
    newBranchId,
    config: thread.backendConfig,
  };
  const res = await fetch("/api/branch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`branch failed: ${res.status}`);
  return (await res.json()) as { pending: boolean };
}

// ---- Tree (pi-coding-agent native sessions, for now) --------------------

export interface SessionSummary {
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

export interface TreeResponse {
  sessions: SessionSummary[];
  branches: Record<string, { sessionPath: string | null; forkFrom?: string | null }>;
}

export async function fetchTree(): Promise<TreeResponse> {
  const res = await fetch("/api/tree");
  if (!res.ok) throw new Error(`tree fetch failed: ${res.status}`);
  return (await res.json()) as TreeResponse;
}

// ---- Workspace (pi-coding-agent only) -----------------------------------

export interface WorkspaceFile {
  relpath: string;
  bytes: number;
}

export interface WorkspaceResponse {
  workspaceDir: string;
  files: WorkspaceFile[];
}

export async function fetchWorkspace(threadId: string): Promise<WorkspaceResponse> {
  const res = await fetch(`/api/workspace?threadId=${encodeURIComponent(threadId)}`);
  if (!res.ok) throw new Error(`workspace fetch failed: ${res.status}`);
  return (await res.json()) as WorkspaceResponse;
}
