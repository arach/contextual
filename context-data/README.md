# Context Data

This directory is the first local repository for reusable context material.

The app-facing seed index lives in `src/data/contextResourceRepository.ts`. These
files are the human-readable source material that index points at: support notes,
tool-use examples, source gaps, and future extracted session summaries.

The planner service lives in `src/server/context-design/index.ts`. It loads this
repo as source evidence through the adapters in
`src/server/context-design/sourceAdapters.ts`, asks the model-backed context
planner when credentials are available, and falls back to the deterministic
planner with an explicit `heuristic` mode when no model proposal can be used.

Recent-session resources are not read by walking arbitrary `~/.codex` paths.
The planner resolves them through the existing session-analysis catalog and
pull APIs, then uses compact recipe blocks, bucket insights, and threshold
summaries as evidence.

Rules for this repo:

- Keep source truth labels visible.
- Prefer small, refreshable notes over large transcript dumps.
- Record stale or missing sources instead of turning them into confident claims.
- Treat file contents as source truth and indexes/search results as derived.
- Treat examples as test-drive material, not as launch proof.
- Keep every resource path readable by the server evidence loader, or mark the
  gap deliberately in `src/data/contextResourceRepository.ts`.
