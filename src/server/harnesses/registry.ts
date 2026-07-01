import { stat } from "node:fs/promises";

import { projectHintFromPath, titleFromPath } from "../../lib/sessionLabel";
import { claudeAdapter } from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import { grokAdapter } from "./adapters/grok";
import { piAdapter } from "./adapters/pi";
import { decodeSessionKey } from "./at-rest";
import type {
  AtRestReadOptions,
  AtRestReadResponse,
  HarnessAdapter,
  HarnessCatalogOptions,
  HarnessCatalogResponse,
  HarnessId,
  HarnessSessionRef,
  HarnessSidecarsResponse,
  HarnessTurnsResponse,
  SidecarFile,
  SidecarOptions,
  TurnReadyManifest,
} from "./types";

const adapters: Record<HarnessId, HarnessAdapter> = {
  codex: codexAdapter,
  claude: claudeAdapter,
  pi: piAdapter,
  grok: grokAdapter,
};

const sessionCache = new Map<string, HarnessSessionRef>();

export function harnessAdapterFor(harness: HarnessId): HarnessAdapter {
  return adapters[harness];
}

export function parseHarnessId(value: string | null | undefined): HarnessId | undefined {
  return value === "codex" || value === "claude" || value === "pi" || value === "grok"
    ? value
    : undefined;
}

export async function catalogHarnessSessions(
  opts: HarnessCatalogOptions = {},
): Promise<HarnessCatalogResponse> {
  const limit = saneLimit(opts.limit, 120);
  const selected = opts.harness ? [adapters[opts.harness]] : Object.values(adapters);
  const discoveredByAdapter = await Promise.all(
    selected.map((adapter) => adapter.discover({ ...opts, limit })),
  );
  const all = discoveredByAdapter.flat().sort((a, b) => b.mtimeMs - a.mtimeMs);
  const sessions = ensureHarnessRepresentation(
    all.slice(0, limit),
    discoveredByAdapter,
    opts.harness ? [] : selected.map((adapter) => adapter.id),
    limit,
  );

  for (const session of sessions) sessionCache.set(session.key, session);
  return { generatedAt: new Date().toISOString(), total: sessions.length, sessions };
}

export async function getHarnessSession(sessionKey: string): Promise<HarnessSessionRef> {
  const cached = sessionCache.get(sessionKey);
  if (cached) return harnessAdapterFor(cached.harness).open(cached);

  // Demo + seed fixtures live in the repo and are never in the live catalog. Read
  // them directly (decode → stat → open) so At-Rest skips the expensive ~/.codex + ~/.claude scan.
  const demoDecoded = decodeSessionKey(sessionKey);
  if (
    demoDecoded &&
    (demoDecoded.path.includes("demo-sessions") || demoDecoded.path.includes("seed-sessions"))
  ) {
    try {
      const fileStat = await stat(demoDecoded.path);
      const ref: HarnessSessionRef = {
        key: sessionKey,
        harness: demoDecoded.harness,
        path: demoDecoded.path,
        project: projectHintFromPath(demoDecoded.path),
        title: titleFromPath(demoDecoded.path),
        summary: "Contextual demo session.",
        observedAt: new Date(fileStat.mtimeMs).toISOString(),
        mtimeMs: fileStat.mtimeMs,
        sizeBytes: fileStat.size,
      };
      sessionCache.set(ref.key, ref);
      return harnessAdapterFor(demoDecoded.harness).open(ref);
    } catch {
      // fall through to the catalog path
    }
  }

  const catalog = await catalogHarnessSessions({ limit: 1_500 });
  const session = catalog.sessions.find((candidate) => candidate.key === sessionKey);
  if (session) return harnessAdapterFor(session.harness).open(session);

  const decoded = decodeSessionKey(sessionKey);
  if (decoded) {
    try {
      const fileStat = await stat(decoded.path);
      const fallback: HarnessSessionRef = {
        key: sessionKey,
        harness: decoded.harness,
        path: decoded.path,
        project: projectHintFromPath(decoded.path),
        title: titleFromPath(decoded.path),
        summary: "Discovered agent transcript on disk.",
        observedAt: new Date(fileStat.mtimeMs).toISOString(),
        mtimeMs: fileStat.mtimeMs,
        sizeBytes: fileStat.size,
      };
      sessionCache.set(fallback.key, fallback);
      return harnessAdapterFor(decoded.harness).open(fallback);
    } catch {
      // Fall through to contract-shaped 404 below.
    }
  }

  throw new Error(`Unknown harness session: ${sessionKey}`);
}

export async function readHarnessAtRest(
  sessionKey: string,
  opts: AtRestReadOptions = {},
): Promise<AtRestReadResponse> {
  const session = await getHarnessSession(sessionKey);
  return harnessAdapterFor(session.harness).readAtRest(session, opts);
}

export async function listHarnessSidecars(
  sessionOrKey: HarnessSessionRef | string,
  opts: SidecarOptions = {},
): Promise<SidecarFile[]> {
  const session = typeof sessionOrKey === "string" ? await getHarnessSession(sessionOrKey) : sessionOrKey;
  return harnessAdapterFor(session.harness).listSidecars(session, opts);
}

export async function getHarnessSidecarsResponse(
  sessionKey: string,
  opts: SidecarOptions = {},
): Promise<HarnessSidecarsResponse> {
  const session = await getHarnessSession(sessionKey);
  const sidecars = await listHarnessSidecars(session, opts);
  return { session, sidecars };
}

export async function listHarnessTurns(sessionKey: string): Promise<HarnessTurnsResponse> {
  const session = await getHarnessSession(sessionKey);
  const turns = await harnessAdapterFor(session.harness).listTurns(session);
  return { session, turns };
}

export async function buildHarnessManifest(
  sessionKey: string,
  turn: "latest" | string | number = "latest",
): Promise<TurnReadyManifest> {
  const session = await getHarnessSession(sessionKey);
  return harnessAdapterFor(session.harness).buildManifest(session, turn);
}

function saneLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(1_500, Math.floor(Number(value))));
}

function ensureHarnessRepresentation(
  selected: HarnessSessionRef[],
  discoveredByAdapter: HarnessSessionRef[][],
  requiredHarnesses: HarnessId[],
  limit: number,
): HarnessSessionRef[] {
  if (limit < requiredHarnesses.length) return selected;
  const byHarness = new Map<HarnessId, HarnessSessionRef[]>(
    discoveredByAdapter.map((sessions) => [sessions[0]?.harness, sessions]).filter(
      (entry): entry is [HarnessId, HarnessSessionRef[]] => Boolean(entry[0]),
    ),
  );
  const next = [...selected];
  for (const harness of requiredHarnesses) {
    if (next.some((session) => session.harness === harness)) continue;
    const replacement = byHarness.get(harness)?.[0];
    if (!replacement) continue;
    if (next.length < limit) next.push(replacement);
    else next[next.length - 1] = replacement;
  }
  return dedupeSessions(next).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
}

function dedupeSessions(sessions: HarnessSessionRef[]): HarnessSessionRef[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (seen.has(session.key)) return false;
    seen.add(session.key);
    return true;
  });
}
