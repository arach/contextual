# HANDOFF — Ellipse arrow binding for Eve

**Stage:** A (investigate + hand off). Code is unchanged; this document is the
implementation plan for Stage B.

**Baseline test status (verified 2026-06-30):** `npm test` → **5 passed, 4 failed**.
All rectangle cases pass; all four ellipse cases throw
`ellipse binding not implemented`.

---

## Problem

Eve's canvas attaches arrows to shape boundaries. Given an element (a bounding
box `{ x, y, w, h }` plus a `type` tag) and a point `from` where the arrow
originates, `bindingPoint(element, from)` must return the point on the element's
boundary where the arrow should connect.

Rectangles work. Ellipses are defined in `shapes.mjs` and dispatched in
`binding.mjs`, but the geometry function does not exist yet — the `ELLIPSE` case
throws.

---

## How rectangle binding works today

### Data model (`shapes.mjs`)

Every element is an axis-aligned bounding box with a type tag:

```js
{ type: "rectangle" | "ellipse", x, y, w, h }
```

- `rectangle(x, y, w, h)` → `{ type: "rectangle", x, y, w, h }`
- `ellipse(x, y, w, h)` → `{ type: "ellipse", x, y, w, h }`

The box defines placement and size. For ellipses, the inscribed ellipse fills the
box: center at `(x + w/2, y + h/2)`, semi-axes `rx = w/2` and `ry = h/2`.

### Dispatch (`binding.mjs`)

`bindingPoint(element, from)` switches on `element.type`:

- `RECTANGLE` → `rectangleBindingPoint(element, from)` (implemented)
- `ELLIPSE` → throws `"ellipse binding not implemented"` (the gap)
- unknown → throws

### Geometry (`geometry.mjs`)

Rectangle binding uses a **ray-from-center** model shared by both shapes:

1. Compute center `c = center(box)`.
2. Compute direction `d = from - c` (vector from center toward the arrow source).
3. Walk along the ray `c + t·d` for `t > 0` until the ray hits the boundary.
4. Return that boundary point.

For a rectangle, the boundary is the axis-aligned box edges. The implementation
scales `d` by the smallest factor that reaches an edge:

```js
halfW = w/2, halfH = h/2
scaleX = d.x === 0 ? Infinity : halfW / |d.x|
scaleY = d.y === 0 ? Infinity : halfH / |d.y|
s = min(scaleX, scaleY)
return c + d * s
```

**Intuition:** `scaleX` is how far along `d` you can go before hitting a vertical
edge; `scaleY` before a horizontal edge. The nearer edge wins.

**Degenerate direction:** if `d.x === 0 && d.y === 0` (`from` equals center),
return `c` unchanged. Same guard should apply to ellipses.

### Shared helpers (`geometry.mjs`)

Reuse these — do not duplicate:

| Function | Role |
|----------|------|
| `center(box)` | `{ x: box.x + box.w/2, y: box.y + box.h/2 }` |
| `sub(a, b)` | Vector subtraction |
| `add(a, b)` | Vector addition |
| `scale(v, s)` | Scalar multiply |

---

## Ellipse binding approach

Use the **same ray-from-center model** as rectangles. The only difference is the
boundary shape: an axis-aligned ellipse inscribed in the bounding box.

Given center `c`, semi-axes `rx = w/2`, `ry = h/2`, and direction `d = from - c`,
find scalar `s > 0` such that `p = c + s·d` lies on the ellipse:

```
((p.x - c.x) / rx)² + ((p.y - c.y) / ry)² = 1
```

Substitute `p = c + s·d`:

```
(s·d.x / rx)² + (s·d.y / ry)² = 1
s² · ((d.x/rx)² + (d.y/ry)²) = 1
s = 1 / sqrt((d.x/rx)² + (d.y/ry)²)
```

Return `c + d * s`.

### Circle reduction

When `w === h` (i.e. `rx === ry === r`):

```
s = 1 / sqrt((d.x² + d.y²) / r²) = r / hypot(d.x, d.y) = r / length(d)
```

So `p = c + normalize(d) * r` — standard radial projection to a circle.

### Why this matches the tests

All four failing tests shoot rays along pure horizontal or vertical axes from
outside the shape:

| Test | Box | Center | Radii | From | Expected |
|------|-----|--------|-------|------|----------|
| circle right | 100×100 | (50,50) | r=50 | (200,50) | (100,50) |
| circle bottom | 100×100 | (50,50) | r=50 | (50,200) | (50,100) |
| ellipse right | 200×100 | (100,50) | rx=100, ry=50 | (500,50) | (200,50) |
| ellipse bottom | 200×100 | (100,50) | rx=100, ry=50 | (100,300) | (100,100) |

For horizontal rays (`d.y = 0`): `s = rx/|d.x|`, so `p.x = c.x ± rx` (right/left
extreme of ellipse). For vertical rays (`d.x = 0`): `s = ry/|d.y|`, so
`p.y = c.y ± ry` (bottom/top extreme).

---

## Exactly what to change (Stage B)

### 1. `geometry.mjs` — add `ellipseBindingPoint`

Add a new exported function alongside `rectangleBindingPoint`:

```js
export function ellipseBindingPoint(box, from) {
  const c = center(box);
  const d = sub(from, c);
  if (d.x === 0 && d.y === 0) return c;
  const rx = box.w / 2;
  const ry = box.h / 2;
  const s = 1 / Math.sqrt((d.x / rx) ** 2 + (d.y / ry) ** 2);
  return add(c, scale(d, s));
}
```

Keep it pure; use existing `center`, `sub`, `add`, `scale`. Remove or update the
`NOTE(relay)` comment once implemented.

### 2. `binding.mjs` — wire the dispatch

- Import `ellipseBindingPoint` from `./geometry.mjs`.
- Replace the `ELLIPSE` throw with `return ellipseBindingPoint(element, from)`.
- Remove the `TODO(relay)` comment.

### 3. `shapes.mjs` — optional consistency update

`BINDABLE_TYPES` currently lists only `RECTANGLE`. Nothing in this repo imports
it today, but for API completeness add `ELLIPSE` once binding works:

```js
export const BINDABLE_TYPES = [RECTANGLE, ELLIPSE];
```

Update the comment on lines 15–16 accordingly. **Not required for tests to pass.**

### Do NOT change

- `test.mjs` — tests are the acceptance criteria; fix implementation, not tests.
- `package.json`, `README.md`, scenario docs — out of scope unless you want docs
  parity after the feature lands.

---

## Edge cases

| Case | `from` relative to center | Behavior |
|------|---------------------------|----------|
| Coincident | `from === center` | Return `c` (same as rectangle). Avoids division by zero in `s`. |
| Pure horizontal | `d.y === 0`, `d.x ≠ 0` | `s = rx / \|d.x\|` → point at `(c.x ± rx, c.y)` |
| Pure vertical | `d.x === 0`, `d.y ≠ 0` | `s = ry / \|d.y\|` → point at `(c.x, c.y ± ry)` |
| Diagonal | both nonzero | General formula; for a circle, lands at 45° for symmetric diagonals (e.g. `from=(150,150)` on a 100×100 circle → `(50 + 50/√2, 50 + 50/√2)`) |
| Off-center box | any `x, y` offset | `center(box)` handles translation; ellipse is always inscribed in the box |
| Zero width or height | `w === 0` or `h === 0` | Not covered by tests. Would make `rx` or `ry` zero and blow up the formula. Rectangles have the same class of issue. No special handling needed for this relay. |
| `from` inside ellipse | ray points outward from center | Formula still returns a boundary point on the ray **away from center** (same semantics as rectangle: attach where the ray from center toward `from` exits the shape) |

**Semantic note:** `from` is the arrow's *other* endpoint (where the arrow comes
from), not the binding point. The binding point is where that arrow meets this
element's boundary, found by extending the center→`from` ray outward.

---

## What was verified (Stage A)

1. **`npm test` baseline** — 5 rectangle tests pass; 4 ellipse tests fail with
   `ellipse binding not implemented`. No other failures.

2. **Ellipse formula against all four test expectations** — ran the proposed
   `ellipseBindingPoint` logic in a standalone Node snippet (not committed).
   All four expected coordinates matched within `1e-9`.

3. **Edge-case spot checks** (same standalone snippet):
   - Coincident `from` → returns center `(50, 50)` ✓
   - Vertical approach to wide ellipse → top of box ✓
   - Horizontal approach from left → left edge ✓
   - Diagonal on circle → 45° boundary point ✓

4. **Code trace** — confirmed the full call path for rectangles:
   `test.mjs` → `bindingPoint` → `rectangleBindingPoint` → `center`/`sub`/`scale`/`add`.

5. **`BINDABLE_TYPES`** — grep shows it is defined only in `shapes.mjs` and not
   consumed elsewhere in this package; updating it is optional polish.

---

## Stage B acceptance criteria

```bash
npm test
```

Expected: **9 passed, 0 failed**.

Keep all geometry functions pure (no side effects, no new dependencies). If you
deviate from this handoff (e.g. different edge-case handling, extra exports),
note the deviation in your final message.

---

## Quick reference — file roles

```
shapes.mjs     element constructors + type constants
geometry.mjs   pure math: rectangleBindingPoint (+ ellipseBindingPoint to add)
binding.mjs    type dispatch: bindingPoint(element, from)
test.mjs       acceptance tests (do not edit)
```