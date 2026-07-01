# Seed scenario — Eve binding bug ("Hunt" posture / investigation)

Reproducible sandbox for the namespaced seed captures in
`context-data/seed-sessions/eve-binding/`.

- **Hunt posture (investigation):** accrual-dominated context, tiny durable residue.
- **Bug:** `bindingPoint` in `geometry.mjs` uses `Math.max` where it should use
  `Math.min` (attach at the *nearest* edge). `npm test` is red at baseline.
- **Identical prompt** driven through codex, claude, pi, and grok (note: pi ran on
  MiniMax-M2.7, not codex — the openai-codex provider didn't take effect):
  > Eve's canvas test suite is failing. Run `npm test`, find why bindingPoint
  > returns the wrong attachment point, and fix the bug in geometry.mjs so the
  > suite passes. Keep the function pure and do not modify the test files. When
  > done, briefly explain the root cause.

To re-drive: copy this dir somewhere writable, `git init`, then run each harness
with its working dir set here and capture the produced transcript.
