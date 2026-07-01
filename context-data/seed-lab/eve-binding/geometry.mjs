// Eve canvas — arrow/element binding geometry.
//
// bindingPoint: where an arrow coming from `from` should attach to `shape`'s
// perimeter — the point where the ray from the shape's center toward `from`
// crosses the shape's edge.

import { center } from "./elements.mjs";

/**
 * @param {{x:number,y:number,w:number,h:number}} shape  axis-aligned rectangle
 * @param {{x:number,y:number}} from  external point the arrow comes from
 * @returns {{x:number,y:number}} attachment point on the shape perimeter
 */
export function bindingPoint(shape, from) {
  const c = center(shape);
  const dx = from.x - c.x;
  const dy = from.y - c.y;
  if (dx === 0 && dy === 0) return { x: c.x, y: c.y };

  // Scale the direction outward until it reaches an edge.
  const tx = dx === 0 ? Infinity : (shape.w / 2) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (shape.h / 2) / Math.abs(dy);
  const t = Math.max(tx, ty); // reach the edge

  return { x: c.x + dx * t, y: c.y + dy * t };
}
