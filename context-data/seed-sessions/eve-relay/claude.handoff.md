# HANDOFF — Ellipse binding for Eve's canvas

**Goal:** make `bindingPoint` return the correct boundary point for ellipses, so
the four red ellipse cases in `npm test` pass. Rectangles already work; do not
regress them. Keep geometry pure and **do not edit `test.mjs`.**

## Current state (verified)

`npm test` → `5 passed, 4 failed`. The five rectangle cases pass. The four
ellipse cases fail because `bindingPoint` throws `"ellipse binding not
implemented"` — they are *thrown failures*, not wrong-number failures.

```
ellipse binding:
FAIL  circle right: threw ellipse binding not implemented
FAIL  circle bottom: threw ellipse binding not implemented
FAIL  ellipse right: threw ellipse binding not implemented
FAIL  ellipse bottom: threw ellipse binding not implemented
```

## How rectangle binding works today (the pattern to mirror)

Three files, one clean seam per file:

- **`shapes.mjs`** — constructors `rectangle(x,y,w,h)` / `ellipse(x,y,w,h)` tag
  each element with a `type` (`"rectangle"` / `"ellipse"`). Both kinds are just
  an axis-aligned box `{ type, x, y, w, h }` with a top-left origin. There is
  also `BINDABLE_TYPES = [RECTANGLE]` — exported but **not consumed anywhere**
  (grep confirms no readers), so it's advisory metadata only.
- **`binding.mjs`** — `bindingPoint(element, from)` is the public entry point. It
  `switch`es on `element.type` and delegates to a per-shape geometry function.
  Today: `RECTANGLE` → `rectangleBindingPoint`; `ELLIPSE` → `throw`.
- **`geometry.mjs`** — pure vector helpers (`sub`, `add`, `scale`, `length`,
  `center`) plus `rectangleBindingPoint(box, from)`, which holds the actual math.

So the shape of the work is: **add the math in `geometry.mjs`, wire one
`switch` arm in `binding.mjs`.** Nothing else is structurally required.

`rectangleBindingPoint` is the model to copy (`geometry.mjs:30`). It takes the
center `c`, the ray `d = from - c`, scales that ray until it first touches the
nearer edge pair (`s = min(halfW/|dx|, halfH/|dy|)`), and returns `c + d·s`. Note
its **degenerate-ray guard on line 33**: if `from === c` (`d` is zero) it returns
`c` directly instead of dividing by zero. The ellipse version needs the same
guard.

## Approach for ellipse binding

Same idea as the rectangle, different boundary equation. An axis-aligned ellipse
with center `c` and radii `rx = w/2`, `ry = h/2` satisfies
`((x-cx)/rx)² + ((y-cy)/ry)² = 1`. Walk the ray `d = from - c` outward by a
scalar `s` until it lands on that curve. Substituting `c + d·s` and solving for
the positive root:

```
s = 1 / sqrt( (d.x/rx)² + (d.y/ry)² )
boundary = c + d · s
```

For a circle (`rx === ry === r`) this reduces to `c + normalize(d) · r`. This is
the formula already noted in the comment at `geometry.mjs:42` and in
`SCENARIO.md` — it checks out (worked examples below).

Note `sqrt((d.x/rx)² + (d.y/ry)²)` is exactly `length({ x: d.x/rx, y: d.y/ry })`,
so you can reuse the existing `length` helper and keep the function in the same
idiom as its neighbors.

## Exactly what to change

**1. `geometry.mjs` — add `ellipseBindingPoint`** (mirror `rectangleBindingPoint`,
replace the `NOTE(relay)` comment block at lines 42–44). Suggested:

```js
/**
 * The point on an ellipse's boundary where the ray from its center toward
 * `from` crosses the curve — where an arrow coming from `from` should attach.
 *
 * Scale the center→from ray onto ((x/rx)^2 + (y/ry)^2 = 1).
 */
export function ellipseBindingPoint(box, from) {
  const c = center(box);
  const d = sub(from, c);
  if (d.x === 0 && d.y === 0) return c;   // same guard as the rectangle case
  const rx = box.w / 2;
  const ry = box.h / 2;
  const s = 1 / length({ x: d.x / rx, y: d.y / ry });
  return add(c, scale(d, s));
}
```

**2. `binding.mjs` — wire the dispatch.**
- Line 2: add `ellipseBindingPoint` to the import from `./geometry.mjs`.
- Lines 15–16: replace `throw new Error("ellipse binding not implemented")` with
  `return ellipseBindingPoint(element, from);`.
- The `TODO(relay)` comment in the docblock (lines 8–9) can be dropped.

**3. `shapes.mjs` — recommended, not required for tests.** Update
`BINDABLE_TYPES = [RECTANGLE, ELLIPSE]` (line 17) so the advisory list matches
reality. The tests call `bindingPoint` directly and never read this constant, so
they pass without it — but leaving it as `[RECTANGLE]` would be stale once
ellipses bind. Update the "rectangles only" comment above it (lines 15–16) too.

Do **not** touch `test.mjs`, and keep `ellipseBindingPoint` pure (no side
effects, no new deps) per `CLAUDE.md`.

## Expected math — worked examples (these are the test cases)

| case | box (x,y,w,h) | center | from | d = from−c | s | result |
|---|---|---|---|---|---|---|
| circle right | 0,0,100,100 | (50,50) | (200,50) | (150,0) | 1/√9 = 1/3 | **(100,50)** |
| circle bottom | 0,0,100,100 | (50,50) | (50,200) | (0,150) | 1/3 | **(50,100)** |
| ellipse right | 0,0,200,100 | (100,50) | (500,50) | (400,0) | 1/√16 = 1/4 | **(200,50)** |
| ellipse bottom | 0,0,200,100 | (100,50) | (100,300) | (0,250) | 1/√25 = 1/5 | **(100,100)** |

All four expected results are exact (the divisions land on perfect squares), so
they sit well inside the test's `eps = 1e-9` tolerance — no float fuzz to worry
about for these inputs.

## Edge cases

- **`from === center`** (`d = 0`): `1/√0 = Infinity`, and `0·Infinity = NaN` —
  would produce `{x:NaN,y:NaN}`. The `if (d.x === 0 && d.y === 0) return c;`
  guard handles it, matching `rectangleBindingPoint`. Not directly tested, but
  cheap correctness and keeps parity.
- **Axis-aligned rays** (`d.x === 0` or `d.y === 0`): no special-casing needed —
  the zero term drops out of the sum (`0/ry = 0`), unlike the rectangle which
  needs `Infinity` sentinels for its `min`. The two "bottom" cases exercise this.
- **`from` inside the ellipse:** the formula still projects out *onto* the
  boundary (it scales the ray to the curve; it does not clamp). Same behavior as
  the rectangle — e.g. a circle r=50 with `from` at (60,50) returns (100,50).
  This is the intended "attach to boundary" semantics, not a bug.
- **Degenerate radius** (`w === 0` or `h === 0`): a zero radius makes `d.k/rk`
  divide by zero. Not exercised by the tests and not a valid canvas shape; the
  rectangle code has the analogous gap, so leave it unless you want to add a
  guard for symmetry.

## What I verified

- Reproduced the baseline: `npm test` → 5 passed, 4 failed, all four ellipse
  failures are the thrown "not implemented" error (not wrong numbers).
- Confirmed `BINDABLE_TYPES` has no readers anywhere (`grep` across `*.mjs`), so
  it is metadata-only and not on the test path.
- Implemented the formula above in an **inline scratch eval** (project files left
  untouched) and ran it against all four test cases: all match exactly —
  (100,50), (50,100), (200,50), (100,100).
- Checked the edge cases in the same scratch eval: `from === center` → returns
  center (50,50) with the guard; circle corner ray (150,150) → (85.355…, 85.355…)
  i.e. the 45° point `50 + 50/√2`; interior point (60,50) → (100,50) boundary.

The code in this repo is unchanged — only this `HANDOFF.md` was added.
