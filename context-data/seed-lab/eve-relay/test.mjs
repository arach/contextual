// Zero-dependency test runner. Rectangle binding passes at baseline; the
// ellipse cases fail until ellipse binding is implemented (the relay feature).

import { rectangle, ellipse } from "./shapes.mjs";
import { bindingPoint } from "./binding.mjs";

let passed = 0;
let failed = 0;

function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

function expectPoint(label, fn, want, eps = 1e-9) {
  let got;
  try {
    got = fn();
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${label}: threw ${e.message}`);
    return;
  }
  if (got && approx(got.x, want.x, eps) && approx(got.y, want.y, eps)) {
    passed += 1;
    console.log(`  ok  ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
}

console.log("rectangle binding:");
const rect = rectangle(0, 0, 100, 100); // center (50,50)
expectPoint("right", () => bindingPoint(rect, { x: 200, y: 50 }), { x: 100, y: 50 });
expectPoint("left", () => bindingPoint(rect, { x: -200, y: 50 }), { x: 0, y: 50 });
expectPoint("top", () => bindingPoint(rect, { x: 50, y: -200 }), { x: 50, y: 0 });
expectPoint("bottom", () => bindingPoint(rect, { x: 50, y: 200 }), { x: 50, y: 100 });
expectPoint("corner", () => bindingPoint(rect, { x: 150, y: 150 }), { x: 100, y: 100 });

console.log("ellipse binding:");
const circle = ellipse(0, 0, 100, 100); // center (50,50), r=50
expectPoint("circle right", () => bindingPoint(circle, { x: 200, y: 50 }), { x: 100, y: 50 });
expectPoint("circle bottom", () => bindingPoint(circle, { x: 50, y: 200 }), { x: 50, y: 100 });
const wide = ellipse(0, 0, 200, 100); // center (100,50), rx=100, ry=50
expectPoint("ellipse right", () => bindingPoint(wide, { x: 500, y: 50 }), { x: 200, y: 50 });
expectPoint("ellipse bottom", () => bindingPoint(wide, { x: 100, y: 300 }), { x: 100, y: 100 });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
