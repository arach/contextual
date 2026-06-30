import type { ModuleLibrary } from "@/types";

// The shared catalogue of Fixed candidates. Threads reference modules by id;
// the Designer (future) would mutate this catalogue.
export const MODULE_LIBRARY: ModuleLibrary = {
  "taste-and-voice": {
    id: "taste",
    name: "pi-ai-streaming-contract",
    kind: "rules",
    tokens: 4200,
    body: "Stream via pi-ai stream/streamSimple. Events: text_delta, tool_call, tool_call_delta, stop. Tool args arrive as partial-JSON deltas; parse only on stop.",
  },
  "core-architecture": {
    id: "arch",
    name: "eve-architecture-principles",
    kind: "rules",
    tokens: 8100,
    body: "Next.js App Router + React + TypeScript + Tailwind. Provider stays behind lib/ai.ts. Copilot route forwards pi-ai events to the panel over SSE.",
  },
  "design-system": {
    id: "ds",
    name: "excalidraw-canvas-model",
    kind: "doc",
    tokens: 12400,
    body: "Element union: rectangle/ellipse/arrow/text/freedraw/frame. Bindings via startBinding/endBinding (focus/gap). version/versionNonce per element. useCanvas store holds elements + version.",
  },
  "key-decisions": {
    id: "decisions",
    name: "copilot-decisions",
    kind: "log",
    tokens: 6800,
    body: "Why provider behind lib/ai.ts. Why accumulate tool_call_delta and parse on stop. Why draw_shape mutates the canvas once, after stop.",
  },
  "deployment-rules": {
    id: "deploy",
    name: "deployment-rules",
    kind: "rules",
    tokens: 3400,
    body: "Copilot route runs on the Vercel edge runtime. Rate-limit per user id at the edge. Roll back automatically on streaming TTFT p99 > 800ms.",
  },
  "monitoring-stack": {
    id: "monit",
    name: "monitoring-stack",
    kind: "doc",
    tokens: 5100,
    body: "Prom + Grafana for metrics. Loki for logs. Pagerduty for paging. Track copilot TTFT p99 and pi-ai usage cost. SLO targets in /docs/slo.md.",
  },
  "api-schema": {
    id: "api",
    name: "eve-api-schema",
    kind: "doc",
    tokens: 9200,
    body: "Next.js route handlers under app/api. HMAC-signed httpOnly cookie sessions. Canvas autosave keyed on a monotonic version; stale baseVersion returns 409 with the server scene.",
  },
  "interview-protocol": {
    id: "interview",
    name: "provider-eval-protocol",
    kind: "rules",
    tokens: 2800,
    body: "Replay one recorded stream per provider behind pi-ai. Assert identical event shape. Diff only tool-call finalize ordering and usage cost.",
  },
  "research-prompts": {
    id: "rprompts",
    name: "provider-handoff-notes",
    kind: "rules",
    tokens: 2400,
    body: "serializeContext/hydrateContext carry a live thread across providers. Switch on cost via ai.usage. Never assume tool-call ordering is identical across adapters.",
  },
};
