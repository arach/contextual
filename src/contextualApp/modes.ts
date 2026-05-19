export type AppMode = "session" | "designer" | "analysis";

export const APP_MODES: { id: AppMode; label: string }[] = [
  { id: "session", label: "Work" },
  { id: "analysis", label: "Explore" },
  { id: "designer", label: "Packages" },
];
