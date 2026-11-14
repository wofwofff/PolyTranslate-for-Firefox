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

test("the icon remains reachable when selection begins above the viewport", async () => {
  const f = await contentFixture({
    rect: { left: 100, top: -100, right: 300, bottom: 120 },
  });
  f.select();
  assert.ok(
    Number.parseFloat(f.icon.style.top) >= 0,
    "selection bounds can start outside the visible viewport",
  );
});

test("the icon remains reachable when a long selection extends past the right edge", async () => {
  const f = await contentFixture({
    rect: { left: 100, top: 100, right: 1600, bottom: 120 },
  });
  f.select();
  assert.ok(Number.parseFloat(f.icon.style.left) + 32 <= 800);
});

test("modifier key release does not move a cursor-positioned icon", async () => {
  const f = await contentFixture({ settings: { icon_position: "cursor" } });
  f.select();
  const left = f.icon.style.left;
  f.document.emit("keyup", { key: "Control" });
  f.flush();
  assert.equal(
    f.icon.style.left,
    left,
    "unchanged selection should not jump to the text position",
  );
});

test("keyboard selection changes move a cursor-positioned icon to the text", async () => {
  const f = await contentFixture({ settings: { icon_position: "cursor" } });
  f.select();
  const left = f.icon.style.left;
  f.state.focusOffset++;
  f.document.emit("keyup", { key: "ArrowRight", shiftKey: true });
  f.flush();
  assert.ok(f.visible);
  assert.notEqual(f.icon.style.left, left);
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

test("cursor positioning remains inside the viewport at every corner", async () => {
  for (const [clientX, clientY] of [
    [0, 0],
    [800, 0],
    [0, 600],
    [800, 600],
  ]) {
    const f = await contentFixture({ settings: { icon_position: "cursor" } });
    f.document.emit("mouseup", { button: 0, clientX, clientY });
    f.flush();
    const left = Number.parseFloat(f.icon.style.left);
    const top = Number.parseFloat(f.icon.style.top);
    assert.ok(left >= 0 && left + 32 <= 800);
    assert.ok(top >= 0 && top + 32 <= 600);
  }
});
