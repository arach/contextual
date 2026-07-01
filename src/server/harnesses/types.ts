import type {
  AtRestReadResponse,
  HarnessId,
  HarnessSessionRef,
  ManifestPart,
  ManifestPartKind,
  SidecarFile,
  TurnReadyManifest,
  TurnRecord,
} from "@/lib/harnessContract";

export {
  HARNESS_CONTRACT_VERSION,
  type HarnessId,
  type ManifestTruth,
  type ManifestPartKind,
  type ManifestTransfer,
  type HarnessSessionKey,
  type HarnessSessionRef,
  type SourceRef,
  type AtRestLine,
  type AtRestReadResponse,
  type SidecarFile,
  type CompactBoundary,
  type TokenBudgetMetadata,
  type TurnRecord,
  type ManifestPart,
  type TurnReadyManifest,
  type HarnessCatalogResponse,
  type HarnessTurnsResponse,
  type HarnessSidecarsResponse,
} from "@/lib/harnessContract";

export interface AtRestReadOptions {
  fromLine?: number;
  limit?: number;
  includeRaw?: boolean;
}

export interface SidecarOptions {
  includeContent?: boolean;
}

export interface HarnessCatalogOptions {
  harness?: HarnessId;
  cwd?: string;
  q?: string;
  limit?: number;
  maxAgeMs?: number;
}

export type CatalogOptions = HarnessCatalogOptions;

export interface HarnessCapabilities {
  hasLoggedTurnContext: boolean;
  hasCompactionMarkers: boolean;
  hasWorkspaceSidecars: boolean;
  canFork: boolean;
  canReplayPayload: boolean;
}

export interface HarnessAdapter {
  id: HarnessId;
  version: string;
  capabilities: HarnessCapabilities;
  discover(opts?: HarnessCatalogOptions): Promise<HarnessSessionRef[]>;
  open(ref: HarnessSessionRef): Promise<HarnessSessionRef>;
  readAtRest(ref: HarnessSessionRef, opts?: AtRestReadOptions): Promise<AtRestReadResponse>;
  listSidecars(ref: HarnessSessionRef, opts?: SidecarOptions): Promise<SidecarFile[]>;
  listTurns(ref: HarnessSessionRef): Promise<TurnRecord[]>;
  buildManifest(
    ref: HarnessSessionRef,
    turn: "latest" | string | number,
    opts?: { includeSidecarContent?: boolean },
  ): Promise<TurnReadyManifest>;
}

export interface ManifestDiff {
  fromManifestId: string;
  toManifestId: string;
  added: ManifestPart[];
  removed: ManifestPart[];
  changed: Array<{ from: ManifestPart; to: ManifestPart }>;
  tokenDelta: number;
  nonTransferable: ManifestPart[];
}

export interface HotSwapTarget {
  harness: HarnessId;
  model?: string;
  cwd?: string;
  mode: "replay" | "fork" | "summarize-and-fork";
}

export interface HotSwapPlan {
  sourceManifestId: string;
  target: HotSwapTarget;
  transferableParts: ManifestPart[];
  transformedParts: Array<{ fromPartId: string; toKind: ManifestPartKind; reason: string }>;
  droppedParts: Array<{ partId: string; reason: string }>;
  warnings: string[];
  replayBundlePath?: string;
}
