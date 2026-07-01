# AGENTS — eve-relay

Pure, zero-dependency Node (ESM). One canvas concern: binding arrows to the
boundary of an element.

- `geometry.mjs` — vector helpers + `rectangleBindingPoint`.
- `shapes.mjs` — element constructors (`rectangle`, `ellipse`) + type tags.
- `binding.mjs` — `bindingPoint(element, from)`, dispatches by element type.
- `test.mjs` — `npm test`; pure assertions, no framework.

Rectangles bind today. Ellipse binding is intentionally absent — that is the
work. Keep functions pure; do not edit `test.mjs`.
