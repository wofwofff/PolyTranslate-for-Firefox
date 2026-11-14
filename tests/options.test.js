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

test("does not accept a dimension that restore will silently discard", async () => {
  const ui = await optionsFixture();
  ui.edit("window_width", "100000000000000000000");
  await ui.save();
  assert.equal(
    ui.writes.length,
    0,
    "unsafe dimensions must be rejected before storage.set",
  );
});

test("loading settings cannot overwrite an edit made in an enabled field", async () => {
  const ui = await optionsFixture({
    deferLoad: true,
    settings: { window_width: 480 },
  });
  const editable =
    !ui.nodes.get("window_width").disabled &&
    !ui.nodes.get("window-size").disabled;
  if (editable) ui.edit("window_width", 700);
  await ui.load();
  assert.equal(ui.nodes.get("window_width").value, editable ? "700" : "480");
});

test("all inputs remain disabled until initial settings finish loading", async () => {
  const ui = await optionsFixture({ deferLoad: true });
  for (const id of [
    "window_width",
    "window_height",
    "show_icon",
    "close_on_return",
    "window",
    "tab",
    "icon-near-selection",
    "icon-near-cursor",
  ]) {
    assert.equal(ui.nodes.get(id).disabled, true, id);
  }
  await ui.load();
  assert.equal(ui.nodes.get("window_width").disabled, false);
  assert.equal(ui.nodes.get("save").disabled, false);
});

test("storage read failures show an error and unlock the default form", async () => {
  const ui = await optionsFixture({ failLoad: true });
  assert.equal(
    ui.nodes.get("settings-status").textContent,
    "settingsLoadFailed",
  );
  assert.equal(ui.nodes.get("settings-status").dataset.error, "true");
  assert.equal(ui.nodes.get("window_width").disabled, false);
  assert.equal(ui.nodes.get("save").disabled, false);
});
