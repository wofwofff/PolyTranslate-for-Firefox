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

test("the text anchor uses the last word and ignores trailing whitespace and punctuation", async () => {
  const f = await contentFixture();
  f.state.text = "first line\nlast,   \n";
  f.select();
  assert.equal(f.state.lastWord, "last");
  const anchor = f.anchor({
    screenX: 1100,
    screenY: 600,
    clientX: 1000,
    clientY: 500,
  });
  assert.equal(anchor.x, 1100);
  assert.equal(anchor.y, 600);
  assert.equal(anchor.selection.right, 400);
  assert.equal(anchor.selection.bottom, 220);
});

test("backward selections retain the last word in text order", async () => {
  const f = await contentFixture();
  f.state.anchorOffset = f.state.text.length;
  f.state.focusOffset = 0;
  f.select();
  assert.equal(f.state.lastWord, "text");
});

test("word segmentation supports Cyrillic and CJK text", async () => {
  for (const [text, last] of [
    ["первое слово!  ", "слово"],
    ["你好 世界。", "世界"],
  ]) {
    const f = await contentFixture();
    f.state.text = text;
    f.select();
    assert.equal(f.state.lastWord, last);
  }
});

test("CJK letters remain a word when the browser reports isWordLike as false", async () => {
  class Segmenter {
    segment() {
      return [
        { segment: "世界", index: 0, isWordLike: false },
        { segment: "。", index: 2, isWordLike: false },
      ];
    }
  }
  const f = await contentFixture({ segmenter: Segmenter });
  f.state.text = "世界。";
  f.select();
  assert.equal(f.state.lastWord, "世界");
});

test("the icon preserves text selection on primary pointer down", async () => {
  const f = await contentFixture();
  f.select();
  let prevented = false;
  f.icon.emit("mousedown", {
    button: 0,
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
});

test("icon activation retains the last word anchor if selection loses focus", async () => {
  const f = await contentFixture();
  f.select();
  f.state.text = "";
  f.icon.emit("click", {
    screenX: 800,
    screenY: 500,
    clientX: 700,
    clientY: 400,
    stopPropagation() {},
    preventDefault() {},
  });
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].text, "selected text");
  assert.equal(f.messages[0].anchor.selection.right, 400);
  assert.equal(f.messages[0].anchor.selection.bottom, 220);
});

test("keyboard activation falls back to the selected word instead of the screen origin", async () => {
  const f = await contentFixture({ settings: { icon_position: "cursor" } });
  f.select();
  f.icon.emit("click", {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    stopPropagation() {},
    preventDefault() {},
  });
  assert.equal(f.messages[0].anchor.x, 400);
  assert.equal(f.messages[0].anchor.y, 220);
});
