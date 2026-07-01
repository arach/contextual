// Eve canvas — element kinds and helpers.

export const Rectangle = (x, y, w, h) => ({ kind: "rectangle", x, y, w, h });
export const Ellipse = (x, y, w, h) => ({ kind: "ellipse", x, y, w, h });

/** Geometric center of an axis-aligned element. */
export function center(shape) {
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}
