export const EXPLORE_PANEL_IDS = {
  sessions: "explore-panel-sessions",
  tree: "explore-panel-tree",
  inspector: "explore-panel-inspector",
} as const;

export type ExplorePanel = keyof typeof EXPLORE_PANEL_IDS;

export function focusExplorePanel(panel: ExplorePanel): void {
  document.getElementById(EXPLORE_PANEL_IDS[panel])?.focus();
}
