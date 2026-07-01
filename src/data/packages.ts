// Context packages — versioned, named bundles of modules that a thread can
// reference. The Designer view crafts these; the Session view consumes them.
//
// This is intentionally a small flat dataset for the prototype. A real
// version would persist to a workspace store and let modules reference shared
// libraries across packages.

export interface ContextPackage {
  id: string;
  name: string;
  desc: string;
  tags: string[];
  /** Allocated share of the 100k budget, in thousands. */
  budget: number;
  /** Module ids — resolved against MODULE_LIBRARY. */
  modules: string[];
  updated: string;
  version: string;
  history: { version: string; when: string; note: string }[];
  usedByThreads: string[];
}

export const PACKAGES: ContextPackage[] = [
  {
    id: "design",
    name: "copilot",
    desc: "pi-ai streaming contract + Eve architecture + canvas model + copilot decisions.",
    tags: ["eve", "copilot"],
    budget: 35,
    modules: ["taste-and-voice", "core-architecture", "design-system", "key-decisions"],
    updated: "yesterday",
    version: "v0.4",
    history: [
      { version: "v0.4", when: "today", note: "trim pi-ai-streaming-contract" },
      { version: "v0.3", when: "3d", note: "split excalidraw-canvas-model" },
      { version: "v0.2", when: "1w", note: "add copilot-decisions" },
      { version: "v0.1", when: "2w", note: "initial" },
    ],
    usedByThreads: ["design", "research"],
  },
  {
    id: "ops",
    name: "deploy",
    desc: "Edge runtime + monitoring rules for the copilot route. Lives near the runbook.",
    tags: ["sre", "runbook"],
    budget: 15,
    modules: ["deployment-rules", "monitoring-stack"],
    updated: "3d ago",
    version: "v0.2",
    history: [
      { version: "v0.2", when: "3d", note: "add monitoring-stack" },
      { version: "v0.1", when: "2w", note: "initial deployment-rules" },
    ],
    usedByThreads: ["ops"],
  },
  {
    id: "backend",
    name: "persistence",
    desc: "Eve API schema + architecture. Read-only across teams.",
    tags: ["api", "shared"],
    budget: 25,
    modules: ["api-schema", "core-architecture"],
    updated: "1w ago",
    version: "v0.3",
    history: [
      { version: "v0.3", when: "1w", note: "lock eve-api-schema" },
      { version: "v0.2", when: "3w", note: "merge architecture" },
      { version: "v0.1", when: "1mo", note: "initial" },
    ],
    usedByThreads: ["backend"],
  },
  {
    id: "research",
    name: "providers",
    desc: "Provider eval protocol + handoff notes for pi-ai.",
    tags: ["pi-ai"],
    budget: 10,
    modules: ["interview-protocol", "research-prompts"],
    updated: "2w ago",
    version: "v0.1",
    history: [{ version: "v0.1", when: "2w", note: "initial" }],
    usedByThreads: ["research"],
  },
];
