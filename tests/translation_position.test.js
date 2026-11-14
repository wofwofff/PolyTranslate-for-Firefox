import assert from "node:assert/strict";
import test from "node:test";
import { translationPosition } from "../src/translation_position.js";

const screen = { left: 0, top: 0, width: 1440, height: 900 };
const selection = { left: 100, top: 180, right: 350, bottom: 205 };
const anchor = { x: 360, y: 200, screen, selection };
const sourceWindow = { left: 100, top: 50, width: 1200, height: 800 };

test("cursor mode opens at a fixed offset from the pointer", () => {
  assert.deepEqual(translationPosition(anchor, 900, 650), {
    left: 372,
    top: 212,
  });
});

test("cursor mode ignores selection geometry even when the window overlaps it", () => {
  const expected = translationPosition(anchor, 480, 420);
  for (const rect of [
    { left: 0, top: 0, right: 1440, bottom: 900 },
    { left: 10, top: 10, right: 100, bottom: 30 },
    { left: 600, top: 180, right: 1390, bottom: 880 },
  ])
    assert.deepEqual(
      translationPosition({ ...anchor, selection: rect }, 480, 420),
      expected,
    );
});

test("word mode anchors to the last word instead of the pointer", () => {
  const options = { mode: "selection" };
  const expected = { left: 362, top: 217 };
  assert.deepEqual(translationPosition(anchor, 480, 420, options), expected);
  assert.deepEqual(
    translationPosition({ ...anchor, x: 1300, y: 850 }, 480, 420, options),
    expected,
  );
});

test("word mode works without pointer coordinates", () => {
  assert.deepEqual(
    translationPosition({ screen, selection }, 480, 420, { mode: "selection" }),
    { left: 362, top: 217 },
  );
});

test("word mode falls back to the pointer when no word rectangle is available", () => {
  const value = { x: 360, y: 200, screen };
  assert.deepEqual(
    translationPosition(value, 480, 420, { mode: "selection" }),
    translationPosition(value, 480, 420),
  );
});

test("center mode uses the source Firefox window, not the selection or screen center", () => {
  assert.deepEqual(
    translationPosition(anchor, 480, 420, { mode: "center", sourceWindow }),
    { left: 460, top: 240 },
  );
});

test("a centered window does not move when the selection or cursor changes", () => {
  const options = { mode: "center", sourceWindow };
  const expected = translationPosition(anchor, 480, 420, options);
  assert.deepEqual(
    translationPosition({ x: 1400, y: 850, screen }, 480, 420, options),
    expected,
  );
});

test("missing content geometry falls back to the source window center", () => {
  for (const mode of ["cursor", "selection", "center"]) {
    assert.deepEqual(
      translationPosition(null, 480, 420, { mode, sourceWindow }),
      { left: 460, top: 240 },
    );
  }
});

test("source windows outside the primary monitor retain negative desktop coordinates", () => {
  assert.deepEqual(
    translationPosition(null, 480, 420, {
      mode: "center",
      sourceWindow: { left: -1400, top: -50, width: 1200, height: 800 },
    }),
    { left: -1040, top: 140 },
  );
});

test("center mode uses available screen bounds only when the source window is unavailable", () => {
  assert.deepEqual(
    translationPosition({ screen }, 480, 420, { mode: "center" }),
    { left: 480, top: 240 },
  );
});

test("flips horizontally only when the preferred side does not fit and the opposite side does", () => {
  assert.deepEqual(translationPosition({ x: 1390, y: 200, screen }, 900, 650), {
    left: 478,
    top: 212,
  });
});

test("flips vertically only when the opposite side fits", () => {
  assert.deepEqual(translationPosition({ x: 100, y: 850, screen }, 480, 420), {
    left: 112,
    top: 418,
  });
});

test("when neither side fits, it clamps without searching for a different text-free area", () => {
  assert.deepEqual(
    translationPosition(
      {
        x: 720,
        y: 450,
        screen,
        selection: { left: 0, top: 0, right: 1440, bottom: 900 },
      },
      900,
      650,
    ),
    { left: 532, top: 242 },
  );
});

test("wide selections do not push cursor-anchored windows below or above the text", () => {
  assert.deepEqual(
    translationPosition(
      {
        x: 300,
        y: 100,
        screen,
        selection: { left: 20, top: 80, right: 1400, bottom: 110 },
      },
      900,
      650,
    ),
    { left: 312, top: 112 },
  );
});

test("falls back safely when neither source window nor usable anchor is available", () => {
  for (const value of [
    undefined,
    {},
    { x: NaN, y: Infinity, screen },
    { x: 100, y: 100, screen: { width: -1 } },
  ]) {
    assert.deepEqual(translationPosition(value, 900, 650), {});
  }
});

test("rejects invalid dimensions", () => {
  for (const [width, height] of [
    [0, 420],
    [-1, 420],
    [NaN, 420],
    [480, Infinity],
  ]) {
    assert.deepEqual(translationPosition(anchor, width, height), {});
  }
});

test("supports a monitor with negative coordinates", () => {
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

test("keeps fixed-size windows inside available screen bounds whenever they fit", () => {
  for (const width of [320, 640, 900])
    for (const height of [240, 420, 650])
      for (const x of [-20, 10, 720, 1430, 1460])
        for (const y of [-20, 10, 450, 890, 920]) {
          const p = translationPosition({ x, y, screen }, width, height);
          assert.ok(p.left >= 8 && p.top >= 8);
          assert.ok(p.left + width <= 1432 && p.top + height <= 892);
          assert.deepEqual(Object.keys(p).sort(), ["left", "top"]);
        }
});

test("converts Firefox pointer coordinates without changing popup dimensions", () => {
  assert.deepEqual(
    translationPosition(
      {
        x: 200,
        y: 160,
        scaleWithTabZoom: true,
        screen: { left: 0, top: 0, width: 960, height: 600 },
      },
      480,
      500,
      { tabZoom: 1.5 },
    ),
    { left: 312, top: 252 },
  );
});

test("converts the last word rectangle at Firefox page zoom", () => {
  assert.deepEqual(
    translationPosition(
      {
        x: 10,
        y: 10,
        scaleWithTabZoom: true,
        screen: { left: 0, top: 0, width: 960, height: 600 },
        selection: { left: 100, top: 160, right: 180, bottom: 180 },
      },
      480,
      420,
      { tabZoom: 1.5, mode: "selection" },
    ),
    { left: 282, top: 282 },
  );
});

test("source window bounds are never multiplied by page zoom", () => {
  assert.deepEqual(
    translationPosition({ ...anchor, scaleWithTabZoom: true }, 480, 420, {
      tabZoom: 1.5,
      mode: "center",
      sourceWindow,
    }),
    { left: 460, top: 240 },
  );
});

test("keeps desktop coordinates unchanged in browsers without zoomed screen coordinates", () => {
  assert.deepEqual(
    translationPosition(anchor, 900, 650, { tabZoom: 1.5 }),
    translationPosition(anchor, 900, 650),
  );
});
