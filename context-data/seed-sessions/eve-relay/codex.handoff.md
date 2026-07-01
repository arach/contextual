# Ellipse Binding Handoff

## Current State

Rectangle binding already works through a three-file path:

- `shapes.mjs` defines type tags and constructors. `rectangle(...)` and
  `ellipse(...)` both return axis-aligned bounding boxes with a `type` field.
- `binding.mjs` is the type dispatcher. `bindingPoint(element, from)` sends
  `RECTANGLE` elements to `rectangleBindingPoint(element, from)`, but currently
  throws `ellipse binding not implemented` for `ELLIPSE`.
- `geometry.mjs` owns pure geometry helpers and `rectangleBindingPoint(box, from)`.
  That function computes the element center, builds the ray vector from center
  to `from`, scales that ray until it reaches the rectangle boundary, and returns
  the boundary point.

The rectangle algorithm is:

1. `c = center(box)`
2. `d = from - c`
3. If `d` is zero, return `c`.
4. Compute rectangle half extents: `halfW = box.w / 2`, `halfH = box.h / 2`.
5. Compute the ray scale needed to hit vertical or horizontal sides:
   `scaleX = halfW / abs(d.x)` and `scaleY = halfH / abs(d.y)`, using
   `Infinity` when the corresponding component is zero.
6. Use `min(scaleX, scaleY)` so the ray hits the first boundary edge.
7. Return `c + d * s`.

## Implementation Plan

Do not change `test.mjs`.

Change exactly these source areas:

1. `geometry.mjs`
   - Add a pure exported function, likely named `ellipseBindingPoint(box, from)`.
   - Reuse existing helpers: `center`, `sub`, `add`, and `scale`.
   - Keep the same zero-vector behavior as rectangles: if `from` equals the
     ellipse center, return the center.

2. `binding.mjs`
   - Import `ellipseBindingPoint` from `geometry.mjs`.
   - In the `ELLIPSE` switch case, return `ellipseBindingPoint(element, from)`
     instead of throwing.

3. `shapes.mjs`
   - Add `ELLIPSE` to `BINDABLE_TYPES` so shape metadata matches runtime
     dispatch. The expected final value is `[RECTANGLE, ELLIPSE]`.

## Ellipse Math

Each ellipse is represented by its bounding box `{ x, y, w, h }`.

Given:

- `c = center(box)`
- `rx = box.w / 2`
- `ry = box.h / 2`
- `d = from - c`

The boundary point on the ray from the center toward `from` is:

```js
const denominator = Math.sqrt((d.x / rx) ** 2 + (d.y / ry) ** 2);
const s = 1 / denominator;
return add(c, scale(d, s));
```

This comes from the ellipse equation:

```text
((x - c.x) / rx)^2 + ((y - c.y) / ry)^2 = 1
```

Substitute the ray point `p = c + d * s`:

```text
((d.x * s) / rx)^2 + ((d.y * s) / ry)^2 = 1
s^2 * ((d.x / rx)^2 + (d.y / ry)^2) = 1
s = 1 / sqrt((d.x / rx)^2 + (d.y / ry)^2)
```

For a circle, where `rx === ry`, this reduces to `c + normalize(d) * r`.

## Expected Test Cases

The existing tests cover axis-aligned rays:

- `ellipse(0, 0, 100, 100)` from `{ x: 200, y: 50 }` should bind to
  `{ x: 100, y: 50 }`.
- `ellipse(0, 0, 100, 100)` from `{ x: 50, y: 200 }` should bind to
  `{ x: 50, y: 100 }`.
- `ellipse(0, 0, 200, 100)` from `{ x: 500, y: 50 }` should bind to
  `{ x: 200, y: 50 }`.
- `ellipse(0, 0, 200, 100)` from `{ x: 100, y: 300 }` should bind to
  `{ x: 100, y: 100 }`.

The formula should also handle diagonal rays without special cases.

## Edge Cases

- `from` exactly at the ellipse center: return `center(box)`, matching rectangle
  behavior and avoiding division by zero from a zero ray.
- `d.x === 0` or `d.y === 0`: no special branch is required for nonzero rays.
  The formula handles vertical and horizontal rays naturally.
- Degenerate boxes where `w === 0` or `h === 0` are not covered by the current
  tests or shape constructors. The existing rectangle code also does not
  validate dimensions, so avoid adding validation unless project requirements
  change.
- Negative dimensions are likewise outside current behavior. Preserve the
  existing constructor style and pure geometry assumptions.
- Floating point comparisons in tests use `1e-9`, so the direct formula should
  be precise enough.

## Verification Performed

I ran `npm test` before making source changes. Baseline output:

- Rectangle binding: 5 passing assertions.
- Ellipse binding: 4 failing assertions.
- Each ellipse failure throws `ellipse binding not implemented`.

No implementation files or tests were changed in this handoff stage.
