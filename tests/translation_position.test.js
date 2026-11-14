import assert from "node:assert/strict";
import test from "node:test";
import { translationPosition } from "../src/translation_position.js";

const screen = { left: 0, top: 0, width: 1440, height: 900 };
const selection = { left: 100, top: 180, right: 350, bottom: 205 };
const anchor = { x: 360, y: 200, screen, selection };
function intersects(p, width, height, rect) {
  return (
    p.left < rect.right &&
    p.left + width > rect.left &&
    p.top < rect.bottom &&
    p.top + height > rect.top
  );
}

test("opens beside the selection and returns position only", () => {
  const p = translationPosition(anchor, 900, 650);
  assert.equal(p.left, 372);
  assert.ok(!intersects(p, 900, 650, selection));
  assert.deepEqual(Object.keys(p).sort(), ["left", "top"]);
});

test("flips left near the right edge without covering the selection", () => {
  const rect = { left: 1250, top: 180, right: 1380, bottom: 205 };
  const p = translationPosition(
    { x: 1390, y: 200, screen, selection: rect },
    900,
    650,
  );
  assert.ok(p.left + 900 < rect.left);
  assert.ok(!intersects(p, 900, 650, rect));
});

test("places a full-sized window below a wide selection", () => {
  const rect = { left: 20, top: 80, right: 1400, bottom: 110 };
  const p = translationPosition(
    { x: 1410, y: 100, screen, selection: rect },
    900,
    650,
  );
  assert.ok(p.top >= rect.bottom + 12);
  assert.ok(!intersects(p, 900, 650, rect));
});

test("falls back safely without pointer metadata", () => {
  for (const value of [
    undefined,
    {},
    { x: NaN, y: Infinity, screen },
    { x: 100, y: 100, screen: { width: -1 } },
  ]) {
    assert.deepEqual(translationPosition(value, 900, 650), {});
  }
});

test("supports a monitor with negative desktop coordinates", () => {
  const p = translationPosition(
    {
      x: -5,
      y: 500,
      screen: { left: -1440, top: -50, width: 1440, height: 900 },
    },
    900,
    650,
  );
  assert.ok(p.left >= -1432 && p.top >= -42);
  assert.ok(p.left + 900 <= -8 && p.top + 650 <= 842);
});

test("moves an oversized window to the screen origin without resizing", () => {
  assert.deepEqual(
    translationPosition(
      { x: 620, y: 450, screen: { left: 0, top: 0, width: 640, height: 480 } },
      900,
      650,
    ),
    { left: 8, top: 8 },
  );
});

test("keeps fixed-size windows within the screen whenever they fit", () => {
  for (const width of [320, 640, 900]) {
    for (const height of [240, 420, 650]) {
      for (const x of [-20, 10, 720, 1430, 1460]) {
        for (const y of [-20, 10, 450, 890, 920]) {
          const p = translationPosition({ x, y, screen }, width, height);
          assert.ok(p.left >= 8 && p.top >= 8);
          assert.ok(p.left + width <= 1432 && p.top + height <= 892);
        }
      }
    }
  }
});

test("converts Firefox zoom coordinates without scaling window dimensions", () => {
  const p = translationPosition(
    {
      x: 200,
      y: 160,
      scaleWithTabZoom: true,
      screen: { left: 0, top: 0, width: 960, height: 600 },
    },
    480,
    500,
    1.5,
  );
  assert.deepEqual(p, { left: 312, top: 240 });
});

test("keeps desktop coordinates unchanged in other browsers", () => {
  assert.deepEqual(
    translationPosition(anchor, 900, 650, 1.5),
    translationPosition(anchor, 900, 650),
  );
});
