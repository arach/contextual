import { claudeAdapter } from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import { piAdapter } from "./adapters/pi";
import type {
  AtRestReadOptions,
  AtRestReadResponse,
  HarnessAdapter,
  HarnessCatalogOptions,
  HarnessCatalogResponse,
  HarnessId,
  HarnessSessionRef,
  SidecarFile,
  SidecarOptions,
  TurnReadyManifest,
  TurnRecord,
} from "./types";

const adapters: Record<HarnessId, HarnessAdapter> = {
  codex: codexAdapter,
  claude: claudeAdapter,
  pi: piAdapter,
};

const sessionCache = new Map<string, HarnessSessionRef>();

export function harnessAdapterFor(harness: HarnessId): HarnessAdapter {
  return adapters[harness];
}

export function parseHarnessId(value: string | null | undefined): HarnessId | undefined {
  return value === "codex" || value === "claude" || value === "pi" ? value : undefined;
}

export async function catalogHarnessSessions(
  opts: HarnessCatalogOptions = {},
): Promise<HarnessCatalogResponse> {
  const selected = opts.harness ? [adapters[opts.harness]] : Object.values(adapters);
  const discovered = await Promise.all(selected.map((adapter) => adapter.discover({ ...opts, limit: opts.limit ?? 120 })));
  const sessions = discovered
    .flat()
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, opts.limit ?? 120);
  for (const session of sessions) sessionCache.set(session.key, session);
  return { generatedAt: new Date().toISOString(), total: sessions.length, sessions };
}

export async function getHarnessSession(sessionKey: string): Promise<HarnessSessionRef> {
  const cached = sessionCache.get(sessionKey);
  if (cached) return harnessAdapterFor(cached.harness).open(cached);

  const catalog = await catalogHarnessSessions({ limit: 1_500 });
  const session = catalog.sessions.find((candidate) => candidate.key === sessionKey);
  if (!session) throw new Error(`Unknown harness session: ${sessionKey}`);
  return harnessAdapterFor(session.harness).open(session);
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

export async function listHarnessTurns(sessionKey: string): Promise<{ session: HarnessSessionRef; turns: TurnRecord[] }> {
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
