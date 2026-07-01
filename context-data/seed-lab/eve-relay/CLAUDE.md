# Eve — canvas editor (relay sandbox)

Eve is a lightweight Excalidraw-style canvas. This package holds the binding
geometry that attaches arrows to shapes (`geometry.mjs`, `shapes.mjs`,
`binding.mjs`).

## Working rules
- Keep geometry functions pure — no side effects, no new dependencies.
- Verify with `npm test` before declaring done.
- Fix the implementation; do not modify the test files.
