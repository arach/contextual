import type { Metadata } from "next";
import { getHudsonThemeScript } from "hudsonkit/theme-script";

import { CONTEXTUAL_THEME_DEFAULTS } from "@/contextualApp/themeConfig";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contextual",
  description: "Context engineering as a first-class UX surface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getHudsonThemeScript(CONTEXTUAL_THEME_DEFAULTS),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
