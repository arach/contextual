import type { ModuleLibrary } from "@/types";

// The shared catalogue of Fixed candidates. Threads reference modules by id;
// the Designer (future) would mutate this catalogue.
export const MODULE_LIBRARY: ModuleLibrary = {
  "taste-and-voice": {
    id: "taste",
    name: "taste-and-voice",
    kind: "rules",
    tokens: 4200,
    body: "Bold, terse. No emoji. Editorial, not corporate. One thousand no's for every yes.",
  },
  "core-architecture": {
    id: "arch",
    name: "core-architecture-principles",
    kind: "rules",
    tokens: 8100,
    body: "Decoupled threads from context rack. Stateless calls. Fixed/Soft split is the core mental model.",
  },
  "design-system": {
    id: "ds",
    name: "design-system",
    kind: "doc",
    tokens: 12400,
    body: "Tokens, type scale, component grammar. Geist + Geist Mono. Hangar palette — orange tactical.",
  },
  "key-decisions": {
    id: "decisions",
    name: "key-decisions",
    kind: "log",
    tokens: 6800,
    body: "Why Soft/Fixed. Why per-thread budgets. Why summaries every 20 turns.",
  },
  "deployment-rules": {
    id: "deploy",
    name: "deployment-rules",
    kind: "rules",
    tokens: 3400,
    body: "Blue/green only. Canary 5%→25%→100% over 30min. Roll back automatically on p99 > 800ms.",
  },
  "monitoring-stack": {
    id: "monit",
    name: "monitoring-stack",
    kind: "doc",
    tokens: 5100,
    body: "Prom + Grafana for metrics. Loki for logs. Pagerduty for paging. SLO targets in /docs/slo.md.",
  },
  "api-schema": {
    id: "api",
    name: "api-schema",
    kind: "doc",
    tokens: 9200,
    body: "REST + JSON. Versioned via /v1/, /v2/. Pagination is cursor-based. Errors follow RFC7807.",
  },
  "interview-protocol": {
    id: "interview",
    name: "interview-protocol",
    kind: "rules",
    tokens: 2800,
    body: "60min. 5min intro, 40min open-ended, 10min specific probes, 5min wrap. No leading questions.",
  },
  "research-prompts": {
    id: "rprompts",
    name: "research-prompts",
    kind: "rules",
    tokens: 2400,
    body: "Always ask 'why' three layers deep. Reflect back, don't paraphrase. Capture verbatim quotes.",
  },
};
