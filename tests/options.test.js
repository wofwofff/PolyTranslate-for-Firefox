import assert from "node:assert/strict";
import test from "node:test";
import { optionsFixture } from "./helpers/options.js";

test("restores persisted settings and disables dependent controls", async () => {
  const ui = await optionsFixture({
    settings: { target: "tab", show_icon: false, window_width: 480 },
  });
  assert.equal(ui.nodes.get("window_width").value, "480");
  assert.equal(ui.nodes.get("window-size").disabled, true);
  assert.equal(ui.nodes.get("icon-position").disabled, true);
  assert.equal(ui.nodes.get("save").disabled, false);
});

test("rejects dimensions below HTML minimum and focuses the invalid input", async () => {
  const ui = await optionsFixture();
  ui.edit("window_width", 319);
  await ui.save();
  assert.equal(ui.writes.length, 0);
  assert.equal(ui.nodes.get("window_width").focused, true);
  assert.equal(ui.nodes.get("width-error").hidden, false);
});

test("tab mode preserves the last saved dimensions", async () => {
  const ui = await optionsFixture({
    settings: { window_width: 480, window_height: 420 },
  });
  ui.edit("window_width", "");
  ui.form.elements.target.value = "tab";
  ui.form.emit("change");
  await ui.save();
  assert.equal(ui.stored.window_width, 480);
  assert.equal(ui.stored.window_height, 420);
  assert.equal(ui.nodes.get("settings-status").textContent, "settingsSaved");
});
