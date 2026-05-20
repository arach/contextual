export type LoadPhase =
  | { stage: "idle" }
  | { stage: "catalog"; label: string }
  | { stage: "active"; label: string; path: string }
  | { stage: "corpus"; done: number; total: number }
  | { stage: "ready" }
  | { stage: "error"; message: string };

export function loadPhaseLabel(phase: LoadPhase): string {
  switch (phase.stage) {
    case "idle":
      return "starting…";
    case "catalog":
      return phase.label;
    case "active":
      return phase.label;
    case "corpus":
      return phase.done >= phase.total
        ? "finishing up…"
        : `analyzing sessions · ${phase.done} / ${phase.total}`;
    case "ready":
      return "";
    case "error":
      return phase.message;
  }
}

export function loadPhaseColor(phase: LoadPhase): "amber" | "red" | "emerald" | "neutral" {
  if (phase.stage === "error") return "red";
  if (phase.stage === "ready") return "emerald";
  return "amber";
}

export function isCatalogReady(phase: LoadPhase): boolean {
  return phase.stage === "active" || phase.stage === "corpus" || phase.stage === "ready";
}

export function isInitialLoad(phase: LoadPhase): boolean {
  return phase.stage === "idle" || phase.stage === "catalog";
}
