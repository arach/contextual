"use client";

import { BackendChip } from "@/components/chrome/BackendChip";
import { TopBarActions } from "@/components/chrome/TopBarActions";
import { ModeSwitch } from "@/contextualApp/ModeSwitch";
import { useContextualApp } from "@/contextualApp/ContextualProvider";

export function ContextualNavCenter() {
  const { mode, setMode, store } = useContextualApp();

  return (
    <div className="flex items-center gap-4">
      <ModeSwitch mode={mode} onChange={setMode} />
      {mode === "session" && (
        <BackendChip value={store.active.backendConfig} onChange={store.setBackendConfig} />
      )}
    </div>
  );
}

export function ContextualNavActions() {
  const { store } = useContextualApp();
  return <TopBarActions threadCount={store.threads.length} />;
}
