// Eve canvas — binding geometry tests. Plain Node, no dependencies.
// Run: npm test   (node test.mjs)

import { bindingPoint } from "./geometry.mjs";
import { Rectangle } from "./elements.mjs";

let failures = 0;
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

function expectPoint(actual, exp, label) {
  if (!approx(actual.x, exp.x) || !approx(actual.y, exp.y)) {
    failures++;
    console.error(`FAIL ${label}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function onPerimeter(shape, p, label) {
  const left = shape.x, right = shape.x + shape.w;
  const top = shape.y, bottom = shape.y + shape.h;
  const onV = (approx(p.x, left) || approx(p.x, right)) && p.y >= top - 1e-6 && p.y <= bottom + 1e-6;
  const onH = (approx(p.y, top) || approx(p.y, bottom)) && p.x >= left - 1e-6 && p.x <= right + 1e-6;
  if (!(onV || onH)) {
    failures++;
    console.error(`FAIL ${label}: ${JSON.stringify(p)} is not on the perimeter of ${JSON.stringify(shape)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const sq = Rectangle(0, 0, 100, 100); // center (50, 50)

// 1. arrow from the right -> attaches on the right edge at mid-height
expectPoint(bindingPoint(sq, { x: 300, y: 50 }), { x: 100, y: 50 }, "right edge");

// 2. arrow from directly above -> top edge at mid-width
expectPoint(bindingPoint(sq, { x: 50, y: -200 }), { x: 50, y: 0 }, "top edge");

// 3. arrow from a shallow diagonal -> crosses the right edge, stays on perimeter
onPerimeter(sq, bindingPoint(sq, { x: 300, y: 75 }), "diagonal stays on perimeter");

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nall tests passed");
