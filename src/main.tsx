import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Style layering order is significant:
//   1. Hudson's prebuilt Tailwind bundle — has chrome's own utility classes.
//   2. Our Tailwind compile — adds every utility WE write that Hudson didn't
//      already include (arbitrary values, grid-cols-N, etc.).
//   3. Contextual v2 theme — Scout-aligned, embed-ready.
import "hudsonkit/styles";
import "@/styles/tailwind.css";
import "@/styles/contextual.css";

document.documentElement.dataset.contextualShell = "scout";

import { App } from "@/App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
