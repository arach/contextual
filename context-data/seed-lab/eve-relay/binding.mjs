import { RECTANGLE, ELLIPSE } from "./shapes.mjs";
import { rectangleBindingPoint } from "./geometry.mjs";

/**
 * Attach an arrow arriving from point `from` to `element`, returning the point
 * on the element's boundary the arrow should connect to. Dispatches by type.
 *
 * TODO(relay): ellipse binding is not implemented. The next engineer should
 * read HANDOFF.md and wire it up so the ellipse tests pass.
 */
export function bindingPoint(element, from) {
  switch (element.type) {
    case RECTANGLE:
      return rectangleBindingPoint(element, from);
    case ELLIPSE:
      throw new Error("ellipse binding not implemented");
    default:
      throw new Error(`unknown element type: ${element.type}`);
  }
}
