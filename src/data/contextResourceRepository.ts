import type {
  AgentAssistedContextDraft,
  LocalContextResource,
} from "@/lib/contextCreation";

export const LOCAL_CONTEXT_RESOURCES: readonly LocalContextResource[] = [
  {
    id: "context-planner-agent",
    title: "Copilot route handler",
    kind: "support-doc",
    path: "app/api/copilot/route.ts",
    tags: ["pi-ai", "streaming", "draw-shape", "sse"],
    summary:
      "Eve's copilot route: streams from pi-ai over SSE, defines the draw_shape tool, and accumulates tool_call_delta partial-JSON to parse on stop.",
    usefulFor:
      "Grounding the agent in how Eve streams the copilot and where draw_shape tool calls originate.",
    tokens: 1900,
    truth: "manual",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "recent-contextual-session",
    title: "Recent Eve copilot build session",
    kind: "recent-session",
    path: "~/.codex/sessions/eve",
    tags: ["recent-session", "copilot", "canvas"],
    summary:
      "Recent work wiring pi-ai streaming into CopilotPanel.tsx, the draw_shape tool, and the useCanvas store on Eve's Excalidraw canvas.",
    usefulFor:
      "Recovering implementation decisions, the current route shape, and the provider-behind-lib/ai.ts boundary.",
    tokens: 18800,
    truth: "logged",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "ctx-presentations",
    title: "Eve architecture notes",
    kind: "support-doc",
    path: "docs/eve/ARCH-001..005.md",
    tags: ["architecture", "app-router", "canvas", "copilot"],
    summary:
      "Five markdown notes covering Eve's Next.js App Router layout, the Excalidraw canvas model, the copilot panel, pi-ai streaming, and the export pipeline.",
    usefulFor:
      "Seeding a concise feature brief without replaying the whole architecture conversation.",
    tokens: 7600,
    truth: "logged",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "context-contracts",
    title: "pi-ai streaming + canvas contracts",
    kind: "support-doc",
    path: "docs/eve/CONTRACT-pi-streaming.md, docs/eve/CONTRACT-canvas-persistence.md",
    tags: ["contract", "pi-ai", "canvas"],
    summary:
      "Existing contracts for pi-ai event ordering (text_delta/tool_call/tool_call_delta/stop) and canvas autosave/conflict semantics keyed on the version counter.",
    usefulFor:
      "Preventing the agent from claiming tool args are complete before stop, or that autosave overwrites on conflict.",
    tokens: 10400,
    truth: "logged",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "agent-harness-context-support",
    title: "Eve repo map",
    kind: "support-doc",
    path: "docs/eve/repo-map.md",
    tags: ["support-material", "repo-map", "eve"],
    summary:
      "Local index of Eve's key files: app/api/copilot/route.ts, components/CopilotPanel.tsx, lib/ai.ts, lib/canvas/exportScene.ts.",
    usefulFor:
      "Giving the planning agent a small local map of Eve files before it opens heavier sources.",
    tokens: 2200,
    truth: "logged",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "tool-use-examples",
    title: "Tool use examples",
    kind: "tool-example",
    path: "context-data/resources/tool-use-examples.md",
    tags: ["tools", "bun-test", "browser", "scout"],
    summary:
      "Local examples for browser checks, bun test / typecheck gates, Scout delegation, and source-backed citations.",
    usefulFor:
      "Teaching a new agent how to verify Eve changes instead of merely reading the briefing.",
    tokens: 5200,
    truth: "manual",
    state: "review",
    lastReviewed: "2026-06-01",
  },
  {
    id: "claude-code-context-notes",
    title: "OpenAI provider adapter notes",
    kind: "support-doc",
    path: "docs/eve/openai-provider-notes.md",
    tags: ["openai", "provider", "tool-call"],
    summary:
      "Placeholder local notes for swapping pi-ai's provider to OpenAI: tool-call finalize ordering, usage cost shape, and streaming differences.",
    usefulFor:
      "Flagging the source gap the planning agent must refresh before promising an anthropic→openai swap.",
    tokens: 6800,
    truth: "reconstructed",
    state: "stale",
    lastReviewed: "2026-05-23",
  },
  {
    id: "agent-memory-systems-research",
    title: "Excalidraw element + binding reference",
    kind: "support-doc",
    path: "docs/eve/excalidraw-elements.md",
    sourceAdapter: "local-file",
    visibility: "on-demand",
    tags: ["excalidraw", "elements", "bindings", "rectangle", "ellipse", "arrow", "text", "freedraw", "frame"],
    summary:
      "Reference for the Excalidraw element union, startBinding/endBinding (focus/gap), version/versionNonce, and the useCanvas store shape.",
    usefulFor:
      "Designing draw_shape against the real element model without inventing fields Excalidraw does not have.",
    tokens: 4200,
    truth: "manual",
    state: "fresh",
    lastReviewed: "2026-06-02",
  },
  {
    id: "synthetic-memory-lessons",
    title: "Export pipeline triage notes",
    kind: "support-doc",
    path: "docs/eve/export-pipeline-triage.md",
    sourceAdapter: "local-file",
    visibility: "on-demand",
    tags: ["excalidraw", "export", "exportToSvg", "exportToCanvas", "fonts", "hidpi", "bbox"],
    summary:
      "Design note isolating three export bugs: SVG font not embedded, PNG scale hardcoded to 1 on HiDPI, and frame children filtered out of the export bbox.",
    usefulFor:
      "Reusing the export entry points (exportToSvg/exportToCanvas) without re-triaging the same three render defects.",
    tokens: 2600,
    truth: "manual",
    state: "fresh",
    lastReviewed: "2026-06-02",
  },
  {
    id: "opencode-context-notes",
    title: "Google provider adapter notes",
    kind: "manual-note",
    path: "docs/eve/google-provider-notes.md",
    tags: ["google", "provider", "unknowns"],
    summary:
      "Thin local notes for the google provider behind pi-ai. Useful mostly because it tells the agent what not to claim.",
    usefulFor:
      "Blocking overconfident google launch profiles until the source can be refreshed.",
    tokens: 2800,
    truth: "manual",
    state: "missing",
    lastReviewed: "2026-05-18",
  },
];

export const AGENT_ASSISTED_CONTEXT_DRAFT: AgentAssistedContextDraft = {
  id: "agent-harness-context",
  title: "Eve Copilot Feature Context",
  objective:
    "Create a tight starter session for extending Eve's copilot: pi-ai streaming, the draw_shape tool, and the Excalidraw canvas it draws onto.",
  target: "codex",
  agent: {
    handle: "@context-planner",
    instruction:
      "Act as the context planning agent for Eve. Select useful Eve resources, compress stale or verbose material, preserve source truth labels, and block claims that cannot be backed by current evidence.",
    summary:
      "The agent keeps the architecture notes and streaming/canvas contracts, compresses the recent copilot build session into decision and repo-map parts, includes tool-use examples as a verification brief, and marks the OpenAI/Google provider adapters as refresh-gated instead of pretending those swaps are proven.",
  },
  resourceIds: [
    "recent-contextual-session",
    "context-planner-agent",
    "ctx-presentations",
    "context-contracts",
    "agent-harness-context-support",
    "tool-use-examples",
    "claude-code-context-notes",
    "opencode-context-notes",
  ],
  selections: [
    {
      resourceId: "context-planner-agent",
      action: "keep",
      slot: "planner-contract",
      reason: "The copilot route handler shows exactly how pi-ai streams and where draw_shape originates.",
      outputTokens: 720,
    },
    {
      resourceId: "ctx-presentations",
      action: "keep",
      slot: "north-star",
      reason: "Fresh, short, and already organized around Eve's architecture and canvas model.",
      outputTokens: 2400,
    },
    {
      resourceId: "context-contracts",
      action: "compress",
      slot: "truth-contract",
      reason: "Streaming and canvas contracts are authoritative but too long for the briefing profile.",
      outputTokens: 1800,
    },
    {
      resourceId: "recent-contextual-session",
      action: "compress",
      slot: "decision-ledger",
      reason: "Recent copilot session holds useful decisions but should not be replayed verbatim.",
      outputTokens: 2600,
    },
    {
      resourceId: "agent-harness-context-support",
      action: "keep",
      slot: "repo-map",
      reason: "Small Eve file index helps the agent navigate the repo without pulling full docs first.",
      outputTokens: 600,
    },
    {
      resourceId: "tool-use-examples",
      action: "keep",
      slot: "verification",
      reason: "The fresh agent needs concrete bun test / browser-check habits and gates.",
      outputTokens: 1200,
    },
    {
      resourceId: "claude-code-context-notes",
      action: "refresh",
      slot: "source-gap",
      reason: "Useful topic, but stale enough to warn before promising the OpenAI provider swap.",
      outputTokens: 500,
    },
    {
      resourceId: "opencode-context-notes",
      action: "drop",
      slot: "source-gap",
      reason: "Too thin for launch claims; keep only the missing-source warning on the google adapter.",
      outputTokens: 160,
    },
  ],
  parts: [
    {
      id: "planner-contract",
      title: "Copilot streaming contract",
      slot: "planner-contract",
      body:
        "The copilot route streams from pi-ai over SSE and emits text_delta/tool_call/tool_call_delta/stop. draw_shape arguments arrive as partial-JSON deltas and are only complete at stop; the route accumulates and parses on stop, never per-delta.",
      sourceIds: ["context-planner-agent"],
      tokens: 520,
      profileIds: ["briefing", "working-set", "deep-pack"],
      truth: "manual",
    },
    {
      id: "north-star",
      title: "Eve architecture and boundary",
      slot: "task-brief",
      body:
        "Eve is a Next.js (App Router) + React + TypeScript + Tailwind collaborative canvas. The copilot panel streams from pi-ai; the provider stays behind lib/ai.ts so anthropic→openai is a one-line swap. draw_shape mutates the Excalidraw useCanvas store; it does not control hidden provider memory or cache.",
      sourceIds: ["ctx-presentations"],
      tokens: 1180,
      profileIds: ["briefing", "working-set", "deep-pack"],
      truth: "logged",
    },
    {
      id: "design-shape",
      title: "Canvas + tool-call data shape",
      slot: "source-backed-object",
      body:
        "The Excalidraw element union is rectangle/ellipse/arrow/text/freedraw/frame with startBinding/endBinding (focus/gap) and version/versionNonce. A draw_shape tool call maps to useCanvas().addElement({ type, x, y, label }), fired once after stop with complete args.",
      sourceIds: ["ctx-presentations", "context-contracts"],
      tokens: 1420,
      profileIds: ["briefing", "working-set", "deep-pack"],
      truth: "logged",
    },
    {
      id: "decision-ledger",
      title: "Recent decisions",
      slot: "decision-ledger",
      body:
        "The copilot panel now streams text_delta incrementally over SSE and replays draw_shape tool calls onto the canvas. The provider stays behind lib/ai.ts. The next step is rate-limiting the edge route and persisting the copilot transcript alongside the canvas autosave.",
      sourceIds: ["recent-contextual-session", "agent-harness-context-support"],
      tokens: 1540,
      profileIds: ["working-set", "deep-pack"],
      truth: "logged",
    },
    {
      id: "verification-brief",
      title: "Verification brief",
      slot: "test-drive",
      body:
        "Before launch, run a context test drive: ask streaming, draw_shape, and provider-swap questions; verify the context does not claim tool args are complete before stop; check token budget and source freshness; run bun test / typecheck / browser gates when implementation work follows.",
      sourceIds: ["tool-use-examples", "context-contracts"],
      tokens: 980,
      profileIds: ["briefing", "working-set", "deep-pack"],
      truth: "manual",
    },
    {
      id: "source-gaps",
      title: "Refresh-gated source gaps",
      slot: "warnings",
      body:
        "The OpenAI and Google provider adapter notes are useful topics but are not fully current in the local repository. The context can mention the gap, but a deep launch promising a provider swap must refresh those sources first.",
      sourceIds: ["claude-code-context-notes", "opencode-context-notes"],
      tokens: 620,
      profileIds: ["working-set", "deep-pack"],
      truth: "reconstructed",
    },
  ],
  profiles: [
    {
      id: "briefing",
      label: "Briefing",
      targetTokens: 4500,
      partIds: ["planner-contract", "north-star", "design-shape", "verification-brief"],
    },
    {
      id: "working-set",
      label: "Working Set",
      targetTokens: 9000,
      partIds: [
        "north-star",
        "planner-contract",
        "design-shape",
        "decision-ledger",
        "verification-brief",
        "source-gaps",
      ],
    },
    {
      id: "deep-pack",
      label: "Deep Pack",
      targetTokens: 18000,
      partIds: [
        "north-star",
        "planner-contract",
        "design-shape",
        "decision-ledger",
        "verification-brief",
        "source-gaps",
      ],
    },
  ],
  testDrive: {
    target: "codex",
    profileId: "working-set",
    budget: 9000,
    checks: [
      {
        id: "budget",
        label: "Budget",
        tone: "ok",
        detail: "Working-set draft is under the 9k target.",
      },
      {
        id: "provenance",
        label: "Provenance",
        tone: "ok",
        detail: "Every launch-critical part points to a local Eve resource id.",
      },
      {
        id: "freshness",
        label: "Freshness",
        tone: "warn",
        detail: "The OpenAI and Google provider notes are refresh-gated before promising a swap.",
      },
      {
        id: "continuity",
        label: "Continuity",
        tone: "ok",
        detail: "The draft labels draw_shape args as complete only at stop.",
      },
    ],
    scenarios: [
      {
        id: "boundary",
        prompt: "Explain how Eve's copilot streams and what it should not claim to control.",
        expectedSignals: [
          "Streams from pi-ai over SSE",
          "Provider stays behind lib/ai.ts; no control over hidden provider memory",
          "draw_shape mutates the Excalidraw canvas store",
        ],
        result: "pass",
        notes: "The compiled prompt contains the streaming contract in the first fixed part.",
      },
      {
        id: "fork-label",
        prompt: "Add a draw_shape variant and stream its tool call onto the canvas.",
        expectedSignals: [
          "Accumulate tool_call_delta and parse only on stop",
          "Provider-swap source freshness warning",
        ],
        result: "pass",
        notes: "The source-gap and verification parts both guard the parse-on-stop claim.",
      },
      {
        id: "opencode-depth",
        prompt: "Give implementation guidance for swapping pi-ai's provider to Google.",
        expectedSignals: [
          "Do not overclaim the google adapter's tool-call ordering",
          "Ask to refresh missing provider source coverage",
        ],
        result: "warn",
        notes: "The draft warns correctly but needs a refreshed google-provider resource before publish.",
      },
    ],
  },
};
