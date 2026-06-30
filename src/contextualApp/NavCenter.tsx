"use client";

import { BackendChip } from "@/components/chrome/BackendChip";
import { DemoChip } from "@/components/chrome/DemoChip";
import { HeaderActions } from "@/components/chrome/HeaderActions";
import { ModeSwitch } from "@/contextualApp/ModeSwitch";
import { useContextualApp } from "@/contextualApp/ContextualProvider";

export function ContextualNavCenter() {
  const { mode, setMode, store } = useContextualApp();

  return (
    <div className="flex items-center gap-4">
      <ModeSwitch mode={mode} onChange={setMode} />
      <DemoChip />
      {mode === "session" && (
        <BackendChip value={store.active.backendConfig} onChange={store.setBackendConfig} />
      )}
    </div>
  );
}

export function ContextualNavActions() {
  return <HeaderActions />;
}
