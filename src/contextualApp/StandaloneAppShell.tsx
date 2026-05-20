"use client";

import { AppShell } from "hudsonkit/app-shell";
import { ThemeProvider } from "hudsonkit";

import { contextualApp } from "@/contextualApp";
import { CONTEXTUAL_THEME_DEFAULTS, CONTEXTUAL_THEME_STORAGE_KEY } from "@/contextualApp/themeConfig";

export { CONTEXTUAL_THEME_STORAGE_KEY };

export function StandaloneAppShell() {
  return (
    <ThemeProvider
      storageKey={CONTEXTUAL_THEME_DEFAULTS.storageKey}
      defaultTheme={CONTEXTUAL_THEME_DEFAULTS.defaultTheme}
      defaultTemplate={CONTEXTUAL_THEME_DEFAULTS.defaultTemplate}
    >
      <AppShell app={contextualApp} assistant={false} managedTheme={false} />
    </ThemeProvider>
  );
}
