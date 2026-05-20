import { useCallback, useEffect, useRef, useState } from "react";

import { ANALYSIS_THRESHOLDS, type SessionAnalysis, type SessionCatalogEntry } from "@/lib/sessionAnalysis";
import { fetchSessionCatalog, pullSessionAnalysis } from "@/lib/sessionAnalysisClient";
import {
  pickDefaultCatalogEntry,
  pickDefaultCatalogEntryId,
  sortCatalogByObserved,
} from "@/lib/sessionExplore";
import { mergeExploreSessions } from "@/lib/sessionExploreNav";
import type { LoadPhase } from "@/lib/sessionLoadPhase";

const NAV_LIMIT = 28;
const CORPUS_BATCH_SIZE = 3;

export interface ProgressiveSessionLoadState {
  catalogEntries: SessionCatalogEntry[];
  sessions: SessionAnalysis[];
  loadPhase: LoadPhase;
  error: string | null;
  activeId: string;
  setActiveId: (id: string) => void;
  ingestSessions: (sessions: SessionAnalysis[]) => void;
  reload: () => void;
}

export function useProgressiveSessionLoad(
  pinnedPaths: string[],
): ProgressiveSessionLoadState {
  const [catalogEntries, setCatalogEntries] = useState<SessionCatalogEntry[]>([]);
  const [sessions, setSessions] = useState<SessionAnalysis[]>([]);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>({ stage: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveIdState] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const pullQueueRef = useRef<Set<string>>(new Set());
  const sessionsByPathRef = useRef<Map<string, SessionAnalysis>>(new Map());

  const mergeSessions = useCallback((incoming: SessionAnalysis[]) => {
    if (!incoming.length) return;
    setSessions((current) => {
      const merged = mergeExploreSessions(current, incoming);
      for (const session of merged) {
        sessionsByPathRef.current.set(session.path, session);
      }
      return merged;
    });
  }, []);

  const pullPaths = useCallback(
    async (paths: string[]) => {
      const pending = paths.filter(
        (path) => path && !sessionsByPathRef.current.has(path) && !pullQueueRef.current.has(path),
      );
      if (!pending.length) return [];
      for (const path of pending) pullQueueRef.current.add(path);
      try {
        const response = await pullSessionAnalysis({ paths: pending });
        mergeSessions(response.sessions);
        return response.sessions;
      } finally {
        for (const path of pending) pullQueueRef.current.delete(path);
      }
    },
    [mergeSessions],
  );

  const ingestSessions = useCallback(
    (incoming: SessionAnalysis[]) => {
      mergeSessions(incoming);
    },
    [mergeSessions],
  );

  const ensureSessionLoaded = useCallback(
    async (id: string) => {
      const known = sessionsByPathRef.current.size
        ? [...sessionsByPathRef.current.values()].find((session) => session.id === id)
        : undefined;
      if (known) return known;

      const entry = catalogEntries.find((candidate) => candidate.id === id);
      if (!entry) return null;

      setLoadPhase({
        stage: "active",
        label: `Analyzing ${entry.title}…`,
        path: entry.path,
      });
      const pulled = await pullPaths([entry.path]);
      return pulled[0] ?? sessionsByPathRef.current.get(entry.path) ?? null;
    },
    [catalogEntries, pullPaths],
  );

  const setActiveId = useCallback(
    (id: string) => {
      setActiveIdState(id);
      void ensureSessionLoaded(id);
    },
    [ensureSessionLoaded],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError(null);
      setLoadPhase({ stage: "catalog", label: "Scanning agent transcripts…" });

      const catalog = await fetchSessionCatalog({ limit: NAV_LIMIT });
      if (cancelled) return;

      const entries = sortCatalogByObserved(catalog.entries);
      setCatalogEntries(entries);

      const defaultEntry = pickDefaultCatalogEntry(entries);
      const defaultId = pickDefaultCatalogEntryId(entries);
      setActiveIdState((current) => current || defaultId);

      if (defaultEntry) {
        setLoadPhase({
          stage: "active",
          label: `Analyzing ${defaultEntry.title}…`,
          path: defaultEntry.path,
        });
        await pullPaths([defaultEntry.path]);
        if (cancelled) return;
      }

      const remainingPaths = entries
        .filter((entry) => entry.path !== defaultEntry?.path)
        .map((entry) => entry.path);

      let done = defaultEntry ? 1 : 0;
      const total = entries.length;
      setLoadPhase({ stage: "corpus", done, total });

      for (let index = 0; index < remainingPaths.length; index += CORPUS_BATCH_SIZE) {
        if (cancelled) return;
        const batch = remainingPaths.slice(index, index + CORPUS_BATCH_SIZE);
        await pullPaths(batch);
        done += batch.length;
        if (cancelled) return;
        setLoadPhase({ stage: "corpus", done: Math.min(done, total), total });
      }

      if (cancelled) return;
      setLoadPhase({ stage: "ready" });
    }

    bootstrap().catch((e: unknown) => {
      if (cancelled) return;
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setLoadPhase({ stage: "error", message });
    });

    return () => {
      cancelled = true;
    };
  }, [pullPaths, reloadToken]);

  useEffect(() => {
    if (!pinnedPaths.length) return;
    const missing = pinnedPaths.filter((path) => !sessionsByPathRef.current.has(path));
    if (!missing.length) return;

    let cancelled = false;
    pullPaths(missing)
      .then((pulled) => {
        if (cancelled || !pulled.length) return;
        const first = pulled[0];
        if (first && !activeId) setActiveIdState(first.id);
      })
      .catch(() => {
        // pinned paths may be stale; keep nav entry until user removes
      });

    return () => {
      cancelled = true;
    };
  }, [pinnedPaths, pullPaths, activeId]);

  const reload = useCallback(() => {
    sessionsByPathRef.current.clear();
    pullQueueRef.current.clear();
    setSessions([]);
    setCatalogEntries([]);
    setLoadPhase({ stage: "idle" });
    setReloadToken((token) => token + 1);
  }, []);

  return {
    catalogEntries,
    sessions,
    loadPhase,
    error,
    activeId,
    setActiveId,
    ingestSessions,
    reload,
  };
}

export function emptyAnalysisResponse() {
  return {
    generatedAt: new Date().toISOString(),
    thresholds: ANALYSIS_THRESHOLDS,
    sessions: [] as SessionAnalysis[],
  };
}
