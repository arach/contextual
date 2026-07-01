# Agent Memory System Patterns

Reviewed: 2026-06-02

This note compares file-backed and prompt-backed memory systems that are relevant
to Contextual's source-adapter design. The implementation target is not hidden
provider memory. It is inspectable source material that Contextual can read,
label, score, and compile into launchable context packages.

## Letta MemFS / Context Repositories

Sources:

- https://docs.letta.com/letta-code/memfs/
- https://docs.letta.com/letta-code/memory/
- https://www.letta.com/blog/context-repositories

Pattern:

- Agent memory is a Markdown directory in a git repository.
- `system/` files are loaded fully on every turn.
- Files outside `system/` are visible through tree position and frontmatter
  descriptions, then loaded on demand.
- The agent can edit memory files and commit/push changes.
- Git history is the audit trail and enables concurrent memory subagents.

Contextual implication:

Use the file tree, frontmatter, and git provenance as source evidence. Do not
copy the whole self-mutating-agent contract. Contextual should propose and
review package/source changes rather than silently rewriting durable truth.

## Claude Code Memory

Sources:

- https://docs.claude.com/en/docs/claude-code/memory
- https://code.claude.com/docs/en/memory

Pattern:

- Project, user, and enterprise `CLAUDE.md` files are prompt-level memory.
- Imports allow a small root memory file to reference deeper files.
- Auto memory writes Markdown under the machine-local project memory directory.
- Startup memory has explicit size limits, with topic files read on demand.

Contextual implication:

This validates a two-tier model: small always-loaded steering material plus
larger referenced notes. Contextual should represent both tiers explicitly in a
source adapter instead of treating every Markdown file as equivalent.

## Cursor Rules

Source:

- https://docs.cursor.com/context/rules

Pattern:

- Project rules live in `.cursor/rules` and are version-controlled.
- User rules are global.
- Generated memories become reusable rules.
- Rule contents are injected at the start of model context when applied.

Contextual implication:

Rules are useful as adapter targets and launch outputs. They are less useful as
source truth because they mix facts, preferences, and instructions unless
Contextual preserves explicit truth labels.

## Basic Memory

Sources:

- https://docs.basicmemory.com/guides/knowledge-format/
- https://docs.basicmemory.com/reference/technical-information
- https://docs.basicmemory.com/reference/mcp-tools-reference

Pattern:

- Plain Markdown files are the source of truth.
- A secondary database indexes the files into a semantic graph.
- MCP tools expose search, read, write, and graph traversal.
- The index is derived and can be rebuilt from the files.

Contextual implication:

This is the cleanest "source first, index second" shape for Contextual. A
Contextual adapter can read Markdown files directly, then optionally add search
or graph traversal without making the database authoritative.

## Cline Memory Bank

Source:

- https://docs.cline.bot/prompting/cline-memory-bank

Pattern:

- A structured `memory-bank/` folder stores project brief, active context,
  progress, decisions, and related notes.
- The memory bank is regular project Markdown and works across tools that can
  read files.

Contextual implication:

Memory Bank is mostly a documentation convention. Contextual can ingest it as a
local-file or file-memory adapter and preserve its structure as source refs.

## Zed Rules

Source:

- https://zed.dev/docs/ai/rules

Pattern:

- `.rules` and compatible files such as `.cursorrules`, `.clinerules`,
  `AGENTS.md`, and `CLAUDE.md` can be auto-included as agent instructions.
- Rules can also be inserted on demand or migrated to skills.

Contextual implication:

This reinforces the need for target-specific compilation. The same source
package may compile to `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, or a memory
tree depending on launch target.

## Adapter Requirements

The Contextual source adapter should:

- Separate source discovery, read, search, and materialization.
- Preserve source ids, source refs, content hashes, adapter ids, and visibility.
- Treat file contents as source truth and indexes as recomputable derivations.
- Distinguish always-loaded memory from on-demand memory.
- Parse Markdown frontmatter for descriptions when available.
- Keep writes explicit and reviewable so truth labels remain meaningful.

The initial implementation should therefore provide:

- `local-file`: reads allowlisted project docs and context-data files.
- `recent-session`: resolves recent harness evidence through session analysis.
- `file-memory`: reads Letta-style Markdown memory trees, surfaces `system/` as
  always-loaded, and leaves other files as on-demand evidence.
