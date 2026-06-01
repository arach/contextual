import type {
  AgentAssistedContextDraft,
  LocalContextResource,
} from "@/lib/contextCreation";

export const LOCAL_CONTEXT_RESOURCES: readonly LocalContextResource[] = [
  {
    id: "context-planner-agent",
    title: "Context planner agent contract",
    kind: "support-doc",
    path: "context-data/resources/context-planner-agent.md",
    tags: ["agent", "planner", "test-drive", "creation"],
    summary:
      "Local contract for how the planning agent selects resources, sculpts context, test-drives drafts, and hands session creation back to the main app.",
    usefulFor:
      "Keeping the agent-assisted creation loop explicit and testable instead of treating planner prose as the artifact.",
    tokens: 1900,
    truth: "manual",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "recent-contextual-session",
    title: "Recent Contextual build session",
    kind: "recent-session",
    path: "~/.codex/sessions/contextual",
    tags: ["recent-session", "studio", "cartridge"],
    summary:
      "Recent Codex work on Contextual Studio, CTX presentations, cartridge routes, and Hudson shell integration.",
    usefulFor:
      "Recovering implementation decisions, current route shape, and the product boundary language.",
    tokens: 18800,
    truth: "logged",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "ctx-presentations",
    title: "CTX presentation set",
    kind: "support-doc",
    path: "docs/presentations/CTX-001..005.md",
    tags: ["north-star", "planner", "launch", "fork"],
    summary:
      "Five markdown planning notes covering boundary, cartridge shape, planner, health, launch, and fork semantics.",
    usefulFor:
      "Seeding a concise session brief without replaying the planning conversation.",
    tokens: 7600,
    truth: "logged",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "context-contracts",
    title: "Session package and launch contracts",
    kind: "support-doc",
    path: "docs/CONTRACT-session-package.md, docs/CONTRACT-launch-and-fork.md",
    tags: ["contract", "provenance", "launch"],
    summary:
      "Existing contracts for package artifacts, source refs, launch recipes, fork plans, and replay semantics.",
    usefulFor:
      "Preventing the agent from making unsupported claims about continuity or hidden memory.",
    tokens: 10400,
    truth: "logged",
    state: "fresh",
    lastReviewed: "2026-06-01",
  },
  {
    id: "agent-harness-context-support",
    title: "Agent harness support notes",
    kind: "support-doc",
    path: "context-data/resources/agent-harness-context-support.md",
    tags: ["support-material", "repo-map", "creation"],
    summary:
      "Local support index for durable Contextual inputs and the expected creation shape.",
    usefulFor:
      "Giving the planning agent a small local map of useful files before it opens heavier sources.",
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
    tags: ["tools", "codex", "browser", "scout"],
    summary:
      "Local examples for browser checks, typecheck/build gates, Scout delegation, and source-backed citations.",
    usefulFor:
      "Teaching a new agent how to verify the context instead of merely reading the briefing.",
    tokens: 5200,
    truth: "manual",
    state: "review",
    lastReviewed: "2026-06-01",
  },
  {
    id: "claude-code-context-notes",
    title: "Claude Code context notes",
    kind: "support-doc",
    path: "context-data/resources/claude-code-context-notes.md",
    tags: ["claude", "memory", "compression"],
    summary:
      "Placeholder local notes for Claude Code context behavior, memory, compaction, and branch semantics.",
    usefulFor:
      "Flagging the source gap the planning agent must refresh before publishing a Claude deep pack.",
    tokens: 6800,
    truth: "reconstructed",
    state: "stale",
    lastReviewed: "2026-05-23",
  },
  {
    id: "opencode-context-notes",
    title: "OpenCode context notes",
    kind: "manual-note",
    path: "context-data/resources/opencode-context-notes.md",
    tags: ["opencode", "session", "unknowns"],
    summary:
      "Thin local notes for OpenCode context behavior. Useful mostly because it tells the agent what not to claim.",
    usefulFor:
      "Blocking overconfident OpenCode launch profiles until the source can be refreshed.",
    tokens: 2800,
    truth: "manual",
    state: "missing",
    lastReviewed: "2026-05-18",
  },
];

export const AGENT_ASSISTED_CONTEXT_DRAFT: AgentAssistedContextDraft = {
  id: "agent-harness-context",
  title: "Agent Harness Context",
  objective:
    "Create a tight starter session for designing Contextual's agentic context planning, cartridge, launch, and fork surfaces.",
  target: "codex",
  agent: {
    handle: "@context-planner",
    instruction:
      "Act as the context planning agent. Select useful resources, compress stale or verbose material, preserve source truth labels, and block claims that cannot be backed by current evidence.",
    summary:
      "The agent keeps the CTX notes and contracts, compresses the recent build session into decision and repo-map parts, includes tool-use examples as a verification brief, and marks Claude/OpenCode as refresh-gated instead of pretending those sources are complete.",
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
      reason: "Defines the agent's job, resource actions, and test-drive gate.",
      outputTokens: 720,
    },
    {
      resourceId: "ctx-presentations",
      action: "keep",
      slot: "north-star",
      reason: "Fresh, short, and already organized around the product boundary.",
      outputTokens: 2400,
    },
    {
      resourceId: "context-contracts",
      action: "compress",
      slot: "truth-contract",
      reason: "Contracts are authoritative but too long for the briefing profile.",
      outputTokens: 1800,
    },
    {
      resourceId: "recent-contextual-session",
      action: "compress",
      slot: "decision-ledger",
      reason: "Recent session contains useful decisions but should not be replayed verbatim.",
      outputTokens: 2600,
    },
    {
      resourceId: "agent-harness-context-support",
      action: "keep",
      slot: "repo-map",
      reason: "Small source index helps the agent navigate local materials without pulling full docs first.",
      outputTokens: 600,
    },
    {
      resourceId: "tool-use-examples",
      action: "keep",
      slot: "verification",
      reason: "The fresh agent needs concrete test-drive habits and gates.",
      outputTokens: 1200,
    },
    {
      resourceId: "claude-code-context-notes",
      action: "refresh",
      slot: "source-gap",
      reason: "Useful topic, but stale enough to warn before deep Claude launches.",
      outputTokens: 500,
    },
    {
      resourceId: "opencode-context-notes",
      action: "drop",
      slot: "source-gap",
      reason: "Too thin for launch claims; keep only the missing-source warning.",
      outputTokens: 160,
    },
  ],
  parts: [
    {
      id: "planner-contract",
      title: "Planner agent contract",
      slot: "planner-contract",
      body:
        "The planning agent proposes resource actions, context parts, profiles, and a test-drive record. The main app owns session creation; planner prose is supporting evidence, not the artifact.",
      sourceIds: ["context-planner-agent"],
      tokens: 520,
      profileIds: ["briefing", "working-set", "deep-pack"],
      truth: "manual",
    },
    {
      id: "north-star",
      title: "North Star and boundary",
      slot: "task-brief",
      body:
        "Contextual plans what an agent starts with. It does not claim control over hidden provider memory, cache, compression, or in-flight context. Explore and Package are developer-first judgment work; Instantiate and Fork are agent-first execution work.",
      sourceIds: ["ctx-presentations"],
      tokens: 1180,
      profileIds: ["briefing", "working-set", "deep-pack"],
      truth: "logged",
    },
    {
      id: "cartridge-shape",
      title: "Cartridge artifact shape",
      slot: "source-backed-object",
      body:
        "A cartridge is a versioned, source-backed object with intent, objectives, scope, sources, parts, profiles, freshness, evals, history, health, and launch/fork plans. It is not a transcript dump or a hidden-state snapshot.",
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
        "The Studio now renders CTX markdown notes, live cartridge routes, planner/health/launch/fork previews, and a seed agent-harness-context cartridge. The next step is creation: agent-assisted source selection, sculpting, profile compilation, and dry-run testing before session launch.",
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
        "Before launch, run a context test drive: ask boundary, launch, and source-gap questions; verify the context does not overclaim hidden continuity; check token budget and source freshness; run typecheck/build/browser gates when implementation work follows.",
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
        "Claude Code and OpenCode context semantics are useful topics but are not fully current in the local repository. The context can mention the gap, but a deep launch must refresh those sources first.",
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
      partIds: ["planner-contract", "north-star", "cartridge-shape", "verification-brief"],
    },
    {
      id: "working-set",
      label: "Working Set",
      targetTokens: 9000,
      partIds: [
        "north-star",
        "planner-contract",
        "cartridge-shape",
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
        "cartridge-shape",
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
        detail: "Every launch-critical part points to a local resource id.",
      },
      {
        id: "freshness",
        label: "Freshness",
        tone: "warn",
        detail: "Claude and OpenCode are refresh-gated before deep target launches.",
      },
      {
        id: "continuity",
        label: "Continuity",
        tone: "ok",
        detail: "The draft labels replay and recipe-derived launches honestly.",
      },
    ],
    scenarios: [
      {
        id: "boundary",
        prompt: "Explain what Contextual should and should not claim to control.",
        expectedSignals: [
          "Upstream planning before launch",
          "No hidden in-flight provider context control",
          "Source-backed cartridge objects",
        ],
        result: "pass",
        notes: "The compiled prompt contains the boundary in the first fixed part.",
      },
      {
        id: "fork-label",
        prompt: "Create a Claude launch or fork plan from this context.",
        expectedSignals: [
          "Replay or recipe-derived label unless native parent evidence exists",
          "Source freshness warning",
        ],
        result: "pass",
        notes: "The source-gap and verification parts both guard this claim.",
      },
      {
        id: "opencode-depth",
        prompt: "Give implementation guidance for OpenCode context semantics.",
        expectedSignals: [
          "Do not overclaim OpenCode support",
          "Ask to refresh missing source coverage",
        ],
        result: "warn",
        notes: "The draft warns correctly but needs a refreshed resource before publish.",
      },
    ],
  },
};
