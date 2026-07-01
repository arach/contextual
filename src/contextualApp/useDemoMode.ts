"use client";

import { useEffect, useRef, useState } from "react";
import { usePersistentState } from "hudsonkit";

export interface DemoModeState {
  /** True when the app should serve the curated demo corpus (user toggle or env-forced). */
  demo: boolean;
  /** True when CONTEXTUAL_DEMO=1 locks demo on (the user can't switch to real data). */
  demoForced: boolean;
  setDemo: (on: boolean) => void;
}

/**
 * Resolves demo mode from a persisted user toggle plus the server's forced flag
 * (CONTEXTUAL_DEMO=1). Reads /api/config once on boot; if demo is env-forced, it is
 * latched on and the toggle is ignored.
 */
export function useDemoMode(): DemoModeState {
  const [stored, setStored] = usePersistentState<boolean>("contextual.demo", false);
  const [demoForced, setDemoForced] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    let cancelled = false;
    fetch("/api/config")
      .then((res) => (res.ok ? (res.json() as Promise<{ demoForced?: boolean }>) : null))
      .then((cfg) => {
        if (cancelled || !cfg?.demoForced) return;
        setDemoForced(true);
      })
      .catch(() => {
        // config is best-effort; absence just means no env-forced demo
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    demo: stored || demoForced,
    demoForced,
    setDemo: setStored,
  };
}
