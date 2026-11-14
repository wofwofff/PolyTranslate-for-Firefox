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

test("icon waits for stored settings instead of flashing before disabled setting loads", async () => {
  const f = await contentFixture({
    settings: { show_icon: false },
    deferStorage: true,
  });
  f.select();
  assert.equal(
    f.visible,
    false,
    "a previously disabled icon must not flash during settings load",
  );
  f.restore();
  f.flush();
  assert.ok(!f.visible);
});

test("removing a stored setting restores its default value", async () => {
  const f = await contentFixture();
  f.select();
  assert.ok(f.visible);
  f.change({ show_icon: { oldValue: true } });
  f.select();
  assert.ok(f.visible, "removal of show_icon must restore the true default");
});

test("an enabled icon appears after delayed settings load for an existing selection", async () => {
  const f = await contentFixture({ deferStorage: true });
  f.select();
  assert.equal(f.visible, false);
  f.restore();
  f.flush();
  assert.equal(f.visible, true);
});

test("a storage change received during initial loading wins over the old snapshot", async () => {
  const f = await contentFixture({ deferStorage: true });
  f.change({ show_icon: { oldValue: true, newValue: false } });
  f.restore();
  f.select();
  assert.equal(f.visible, false);
});

test("removing icon_position restores selection positioning", async () => {
  const f = await contentFixture({ settings: { icon_position: "cursor" } });
  f.select();
  const left = f.icon.style.left;
  f.change({ icon_position: { oldValue: "cursor" } });
  f.flush();
  assert.notEqual(f.icon.style.left, left);
});
