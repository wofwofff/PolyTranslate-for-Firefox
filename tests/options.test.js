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

test("editing during an asynchronous save must not report unsaved values as saved", async () => {
  const ui = await optionsFixture({ deferSave: true });
  ui.edit("window_width", 700);
  const pending = ui.save();
  ui.edit("window_width", 800);
  await ui.finishSave();
  await pending;
  assert.equal(ui.stored.window_width, 700);
  assert.equal(ui.nodes.get("window_width").value, "800");
  assert.notEqual(
    ui.nodes.get("settings-status").textContent,
    "settingsSaved",
    "the displayed value has not been saved",
  );
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
    "provider-yandex",
    "provider-google",
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

test("storage write failures show an error and allow retrying", async () => {
  const ui = await optionsFixture({ failSave: true });
  await ui.save();
  assert.equal(
    ui.nodes.get("settings-status").textContent,
    "settingsSaveFailed",
  );
  assert.equal(ui.nodes.get("settings-status").dataset.error, "true");
  assert.equal(ui.nodes.get("save").disabled, false);
  assert.equal(ui.form.hasAttribute("aria-busy"), false);
});

test("a pending save blocks duplicate submissions and a later save persists edits", async () => {
  const ui = await optionsFixture({ deferSave: true });
  ui.edit("window_width", 700);
  const pending = ui.save();
  ui.edit("window_width", 800);
  await ui.save();
  assert.equal(ui.writes.length, 1);
  await ui.finishSave();
  await pending;
  await ui.save();
  assert.equal(ui.writes.length, 2);
  assert.equal(ui.stored.window_width, 800);
  assert.equal(ui.nodes.get("settings-status").textContent, "settingsSaved");
});

test("existing profiles without a provider restore and save Yandex", async () => {
  const ui = await optionsFixture();
  assert.equal(ui.form.elements.provider.value, "yandex");
  await ui.save();
  assert.equal(ui.stored.provider, "yandex");
});

test("provider choice persists and restores on reopening settings", async () => {
  const ui = await optionsFixture();
  ui.form.elements.provider.value = "google";
  ui.form.emit("change");
  await ui.save();
  assert.equal(ui.stored.provider, "google");
  const reopened = await optionsFixture({ settings: ui.stored });
  assert.equal(reopened.form.elements.provider.value, "google");
  assert.equal(reopened.nodes.get("provider-google").disabled, false);
});

test("unsupported saved provider values restore the Yandex default", async () => {
  const ui = await optionsFixture({ settings: { provider: "other" } });
  assert.equal(ui.form.elements.provider.value, "yandex");
});

test("provider edits made during saving remain unsaved until the next save", async () => {
  const ui = await optionsFixture({ deferSave: true });
  const pending = ui.save();
  ui.form.elements.provider.value = "google";
  ui.form.emit("change");
  await ui.finishSave();
  await pending;
  assert.equal(ui.stored.provider, "yandex");
  assert.notEqual(ui.nodes.get("settings-status").textContent, "settingsSaved");
  await ui.save();
  assert.equal(ui.stored.provider, "google");
});

test("text mode exposes last-word and centered window placement", async () => {
  const ui = await optionsFixture();
  assert.equal(ui.form.elements.selection_window_position.value, "last_word");
  assert.equal(ui.nodes.get("selection-window-position").disabled, false);
  ui.form.elements.selection_window_position.value = "center";
  ui.form.emit("change");
  await ui.save();
  const reopened = await optionsFixture({ settings: ui.stored });
  assert.equal(
    reopened.form.elements.selection_window_position.value,
    "center",
  );
});

test("cursor mode disables text-only placement without discarding its preference", async () => {
  const ui = await optionsFixture({
    settings: { selection_window_position: "center" },
  });
  ui.form.elements.icon_position.value = "cursor";
  ui.form.emit("change");
  assert.equal(ui.nodes.get("selection-window-position").disabled, true);
  await ui.save();
  assert.equal(ui.stored.selection_window_position, "center");
  ui.form.elements.icon_position.value = "selection";
  ui.form.emit("change");
  assert.equal(ui.nodes.get("selection-window-position").disabled, false);
  assert.equal(ui.form.elements.selection_window_position.value, "center");
});

test("placement remains available to context-menu users with the selection icon disabled", async () => {
  const ui = await optionsFixture({
    settings: { show_icon: false, target: "window" },
  });
  assert.equal(ui.nodes.get("icon-position").disabled, false);
  assert.equal(ui.nodes.get("selection-window-position").disabled, false);
});

test("text window placement is disabled in tab mode", async () => {
  const ui = await optionsFixture({ settings: { target: "tab" } });
  assert.equal(ui.nodes.get("selection-window-position").disabled, true);
});
