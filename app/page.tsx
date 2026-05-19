"use client";

import { AppShell } from "hudsonkit/app-shell";
import { contextualApp } from "@/contextualApp";

export default function HomePage() {
  return <AppShell app={contextualApp} assistant={false} />;
}
