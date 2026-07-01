// Element kinds Eve can place on the canvas. Each is an axis-aligned bounding
// box { x, y, w, h } plus a `type` tag that selects its binding geometry.

export const RECTANGLE = "rectangle";
export const ELLIPSE = "ellipse";

export function rectangle(x, y, w, h) {
  return { type: RECTANGLE, x, y, w, h };
}

export function ellipse(x, y, w, h) {
  return { type: ELLIPSE, x, y, w, h };
}

// Binding is wired for rectangles only. Ellipse is defined here so scenes can
// hold one, but it has no binding geometry yet — see binding.mjs / SCENARIO.md.
export const BINDABLE_TYPES = [RECTANGLE];
