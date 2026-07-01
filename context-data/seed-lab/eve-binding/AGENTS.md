# Eve — canvas editor

Eve is a lightweight Excalidraw-style canvas. This package holds the binding
geometry that attaches arrows to shapes (`geometry.mjs`, `elements.mjs`).

## Working rules
- Keep geometry functions pure — no side effects, no new dependencies.
- Verify with `npm test` before declaring done.
- Fix the implementation; do not modify the test files.
