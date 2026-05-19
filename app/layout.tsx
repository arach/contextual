import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contextual",
  description: "Context engineering as a first-class UX surface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
