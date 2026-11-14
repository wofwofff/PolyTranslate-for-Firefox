import assert from "node:assert/strict";
import test from "node:test";
import { contentFixture } from "./helpers/content.js";

test("enabled icon appears after a normal text selection", async () => {
  const f = await contentFixture();
  f.select();
  assert.ok(f.visible);
});

test("disabled icon does not create UI", async () => {
  const f = await contentFixture({ settings: { show_icon: false } });
  f.select();
  assert.equal(f.icon, undefined);
});
