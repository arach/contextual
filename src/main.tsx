import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Style layering order is significant:
//   1. Hudson's prebuilt Tailwind bundle — has chrome's own utility classes.
//   2. Our Tailwind compile — adds every utility WE write that Hudson didn't
//      already include (arbitrary values, grid-cols-N, etc.).
//   3. Hangar overrides — palette + classification band + corner reticles.
import "hudsonkit/styles";
import "@/styles/tailwind.css";
import "@/styles/hangar.css";

import { App } from "@/App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
