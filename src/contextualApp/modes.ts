export type AppMode = "session" | "designer" | "analysis";
export type AppSurface = "main" | "runtime";
export type AppVerb = "explore" | "package" | "instantiate";

export interface AppModeMeta {
  label: string;
  surface: AppSurface;
  verb: AppVerb;
  primaryUser: "developer" | "agent";
}

export const APP_MODE_META: Record<AppMode, AppModeMeta> = {
  analysis: {
    label: "Explore",
    surface: "main",
    verb: "explore",
    primaryUser: "developer",
  },
  designer: {
    label: "Package",
    surface: "main",
    verb: "package",
    primaryUser: "developer",
  },
  session: {
    label: "Instantiate",
    surface: "runtime",
    verb: "instantiate",
    primaryUser: "agent",
  },
};

export const APP_MODES: ({ id: AppMode } & AppModeMeta)[] = [
  { id: "analysis", ...APP_MODE_META.analysis },
  { id: "designer", ...APP_MODE_META.designer },
  { id: "session", ...APP_MODE_META.session },
];
