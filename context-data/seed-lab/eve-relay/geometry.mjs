// Pure 2D geometry for Eve's canvas binding. No dependencies, no side effects.
// Every element is an axis-aligned bounding box { x, y, w, h } (top-left origin).

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

export function length(v) {
  return Math.hypot(v.x, v.y);
}

export function center(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/**
 * The point on a rectangle's boundary where the ray from its center toward
 * `from` exits the box — i.e. where an arrow coming from `from` should attach.
 *
 * Scale the center→from ray until it just touches the nearer pair of edges.
 */
export function rectangleBindingPoint(box, from) {
  const c = center(box);
  const d = sub(from, c);
  if (d.x === 0 && d.y === 0) return c;
  const halfW = box.w / 2;
  const halfH = box.h / 2;
  const scaleX = d.x === 0 ? Infinity : halfW / Math.abs(d.x);
  const scaleY = d.y === 0 ? Infinity : halfH / Math.abs(d.y);
  const s = Math.min(scaleX, scaleY);
  return add(c, scale(d, s));
}

// NOTE(relay): there is no ellipseBindingPoint yet. Adding one is the task —
// see SCENARIO.md. The math: for center c, radii (rx, ry) and ray d = from - c,
// the boundary point is c + d * s where s = 1 / sqrt((d.x/rx)^2 + (d.y/ry)^2).
