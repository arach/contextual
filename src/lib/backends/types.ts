// Backend abstraction shared by the Vite dev plugin (server) and the React
// app (client). The plugin exports two concrete Backend implementations:
//   - "pi-coding-agent" — current pi CLI subprocess with native session tree
//   - "pi-ai"           — in-process via @earendil-works/pi-ai (statelesss)
//
// Contextual's branch manifest is canonical; a Branch may carry a backendRef
// that points at native state (pi session path), but the tree shape lives in
// the app, not the backend.

import type { Usage } from "@earendil-works/pi-ai";
// Relative imports so the Vite plugin (which doesn't have the `@/` alias
// during config-time esbuild bundling) can also reuse these types.
import type {
  BackendConfig,
  BackendId,
  ContextModule,
  ProviderId,
  SoftItem,
  ThreadTask,
} from "../../types";

export type { BackendConfig, BackendId, ProviderId } from "../../types";

export interface BackendCapabilities {
  /** Has a native on-disk session/tree model we mirror to. */
  hasNativeSessions: boolean;
  /** Supports OAuth subscription auth (e.g., Claude Pro/Max). */
  hasOAuth: boolean;
  /** Multi-provider — exposes a model picker. */
  hasModelPicker: boolean;
  /** Streaming response events available. */
  hasStreaming: boolean;
  /** Providers exposed (pi-ai only). */
  providers?: ProviderId[];
}

export interface DispatchRequest {
  threadId: string;
  branchId: string;
  fixed: ContextModule[];
  soft: SoftItem[];
  task: ThreadTask | null;
  user: string;
  systemPrompt: string;
  config: BackendConfig;
}

export interface DispatchResult {
  reply: string;
  usage?: Usage;
  /** pi-coding-agent only: path to the JSONL session file. */
  sessionPath?: string;
  /** pi-coding-agent only: parent session path if this dispatch forked. */
  forkedFrom?: string;
  /** pi-coding-agent only: materialized workspace state. */
  workspace?: {
    dir: string;
    files: { relpath: string; bytes: number }[];
  };
}

export interface BranchRequest {
  threadId: string;
  fromBranchId: string;
  newBranchId: string;
  config: BackendConfig;
}

export interface Backend {
  id: BackendId;
  label: string;
  capabilities: BackendCapabilities;
  dispatch(req: DispatchRequest): Promise<DispatchResult>;
  /** Native-session backends can record a fork hint for the next dispatch. */
  branch?(req: BranchRequest): Promise<{ pending: boolean }>;
}
