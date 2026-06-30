import { stat } from "node:fs/promises";

import { readAllJsonlAtRest, readJsonlAtRest } from "../at-rest";
import { buildManifestFromAtRest } from "../manifest";
import { listTurnsFromAtRest } from "../turns";
import type {
  AtRestReadOptions,
  AtRestReadResponse,
  HarnessAdapter,
  HarnessSessionRef,
  SidecarFile,
  TurnReadyManifest,
  TurnRecord,
} from "../types";

// Grok sessions are produced out-of-band (the grok agent over ACP) and captured
// as seed fixtures — never auto-discovered. At-Rest reads the raw ACP
// `updates.jsonl` like any other native transcript.
export const grokAdapter: HarnessAdapter = {
  id: "grok",
  version: "grok-adapter@0.1.0",
  capabilities: {
    hasLoggedTurnContext: false,
    hasCompactionMarkers: false,
    hasWorkspaceSidecars: false,
    canFork: false,
    canReplayPayload: false,
  },
  async discover(): Promise<HarnessSessionRef[]> {
    return [];
  },
  async open(ref: HarnessSessionRef): Promise<HarnessSessionRef> {
    const fileStat = await stat(ref.path);
    return {
      ...ref,
      mtimeMs: fileStat.mtimeMs,
      sizeBytes: fileStat.size,
      observedAt: new Date(fileStat.mtimeMs).toISOString(),
    };
  },
  readAtRest(ref: HarnessSessionRef, opts?: AtRestReadOptions): Promise<AtRestReadResponse> {
    return readJsonlAtRest(ref, opts);
  },
  async listSidecars(): Promise<SidecarFile[]> {
    return [];
  },
  async listTurns(ref: HarnessSessionRef): Promise<TurnRecord[]> {
    return listTurnsFromAtRest(ref, await readAllJsonlAtRest(ref));
  },
  async buildManifest(
    ref: HarnessSessionRef,
    turn: "latest" | string | number,
  ): Promise<TurnReadyManifest> {
    const lines = await readAllJsonlAtRest(ref);
    const turns = listTurnsFromAtRest(ref, lines);
    return buildManifestFromAtRest(ref, lines, turns, [], turn);
  },
};
