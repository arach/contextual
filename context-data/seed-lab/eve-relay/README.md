# eve-relay

Binding geometry for Eve's canvas: given an element and the point an arrow is
coming *from*, return the point on the element's boundary where the arrow should
attach.

```js
import { rectangle, ellipse } from "./shapes.mjs";
import { bindingPoint } from "./binding.mjs";

bindingPoint(rectangle(0, 0, 100, 100), { x: 200, y: 50 }); // → { x: 100, y: 50 }
bindingPoint(ellipse(0, 0, 100, 100), { x: 200, y: 50 });   // → not implemented yet
```

Rectangles work. Ellipse binding is the open feature — run `npm test` to see the
red cases, and see `SCENARIO.md` for the relay protocol used to build it.
