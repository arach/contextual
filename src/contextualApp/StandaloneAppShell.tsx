"use client";

import { AppShell } from "hudsonkit/app-shell";
import { ThemeProvider } from "hudsonkit";
import { FeatureFlagsProvider } from "hudsonkit/flags";

import { contextualApp } from "@/contextualApp";
import {
  CONTEXTUAL_FLAGS,
  CONTEXTUAL_FLAG_AUDIENCE,
  CONTEXTUAL_FLAG_AUDIENCE_ORDER,
  CONTEXTUAL_FLAG_STORAGE_KEY,
} from "@/contextualApp/flags";
import { CONTEXTUAL_THEME_DEFAULTS, CONTEXTUAL_THEME_STORAGE_KEY } from "@/contextualApp/themeConfig";

export { CONTEXTUAL_THEME_STORAGE_KEY };

export function StandaloneAppShell() {
  return (
    <ThemeProvider
      storageKey={CONTEXTUAL_THEME_DEFAULTS.storageKey}
      defaultTheme={CONTEXTUAL_THEME_DEFAULTS.defaultTheme}
      defaultTemplate={CONTEXTUAL_THEME_DEFAULTS.defaultTemplate}
    >
      <FeatureFlagsProvider
        registry={CONTEXTUAL_FLAGS}
        audience={CONTEXTUAL_FLAG_AUDIENCE}
        audienceOrder={CONTEXTUAL_FLAG_AUDIENCE_ORDER}
        storageKey={CONTEXTUAL_FLAG_STORAGE_KEY}
      >
        <AppShell app={contextualApp} assistant={false} managedTheme={false} />
      </FeatureFlagsProvider>
    </ThemeProvider>
  );
}
