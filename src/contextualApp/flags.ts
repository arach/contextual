"use client";

import { createFlagRegistry, useOptionalFlag } from "hudsonkit/flags";

/**
 * Feature flags gate everything beyond the Explore basics, so a fresh install
 * starts minimal and "graduates" capabilities on demand. Flags are toggled at
 * runtime from the ⌘K palette → "Feature Flags", or the flag button in the
 * header. All default OFF — Explore is the only always-on surface.
 *
 * The mechanism is Hudson's `hudsonkit/flags`; this module just declares the
 * Contextual registry and a typed read hook.
 */
export const CONTEXTUAL_FLAGS = createFlagRegistry({
  "surface.package": {
    label: "Package",
    description: "Designer mode — distill reusable context into versioned packages.",
    defaultEnabled: false,
  },
  "surface.instantiate": {
    label: "Instantiate",
    description: "Session runtime — compile a package into a live run.",
    defaultEnabled: false,
  },
  "surface.fork": {
    label: "Fork",
    description: "Branch-and-fork a run with explicit lineage (⌘B).",
    defaultEnabled: false,
  },
  "surface.tree": {
    label: "Fork tree",
    description: "The pi session forest overlay (⌘T).",
    defaultEnabled: false,
  },
  "explore.filters": {
    label: "Explore filters",
    description: "Project filter chips above the session list.",
    defaultEnabled: false,
  },
} as const);

export type ContextualFlagKey = keyof typeof CONTEXTUAL_FLAGS;

/** Single-tier audience — Contextual does not segment flags by audience yet. */
export const CONTEXTUAL_FLAG_AUDIENCE = { tier: "default" as const };
export const CONTEXTUAL_FLAG_AUDIENCE_ORDER = ["default"] as const;
export const CONTEXTUAL_FLAG_STORAGE_KEY = "contextual.flags";

/** Typed flag read. Falls back to false when no provider is mounted (defensive). */
export function useContextualFlag(key: ContextualFlagKey): boolean {
  return useOptionalFlag(key, false);
}
