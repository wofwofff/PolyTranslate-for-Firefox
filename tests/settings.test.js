import assert from "node:assert/strict";
import test from "node:test";
import "../src/defaults.js";

test("normalization rejects invalid dimensions, enums and flags", () => {
  const settings = globalThis.normalizeSettings({
    window_width: "900",
    window_height: Infinity,
    target: "iframe",
    icon_position: "other",
    show_icon: "false",
    close_on_return: null,
  });
  assert.deepEqual(settings, globalThis.DEFAULT_SETTINGS);
  for (const values of [null, undefined, 42, "bad"]) {
    assert.deepEqual(
      globalThis.normalizeSettings(values),
      globalThis.DEFAULT_SETTINGS,
    );
  }
});

test("normalization preserves explicit false and supported enum choices", () => {
  const values = {
    window_width: 320,
    window_height: 240,
    target: "tab",
    icon_position: "cursor",
    show_icon: false,
    close_on_return: false,
    provider: "yandex",
    selection_window_position: "last_word",
  };
  assert.deepEqual(globalThis.normalizeSettings(values), values);
});

test("provider defaults to Yandex and accepts only the supported services", () => {
  assert.equal(globalThis.DEFAULT_SETTINGS.provider, "yandex");
  assert.equal(
    globalThis.normalizeSettings({ provider: "google" }).provider,
    "google",
  );
  for (const provider of [
    undefined,
    null,
    "",
    "yandex",
    "other",
    42,
    "https://evil.test",
  ]) {
    assert.equal(globalThis.normalizeSettings({ provider }).provider, "yandex");
  }
});

test("dimension boundaries reject fractions and native integer overflow", () => {
  for (const [name, minimum] of [
    ["window_width", 320],
    ["window_height", 240],
  ]) {
    assert.equal(globalThis.isValidDimension(name, minimum), true);
    assert.equal(globalThis.isValidDimension(name, 32767), true);
    for (const invalid of [
      minimum - 1,
      32768,
      2 ** 31,
      1e20,
      480.5,
      NaN,
      null,
      "480",
    ]) {
      assert.equal(
        globalThis.isValidDimension(name, invalid),
        false,
        `${name}: ${String(invalid)}`,
      );
      assert.equal(
        globalThis.normalizeSettings({ [name]: invalid })[name],
        globalThis.DEFAULT_SETTINGS[name],
      );
    }
  }
});

test("existing profiles keep word placement while centering is an explicit choice", () => {
  assert.equal(
    globalThis.normalizeSettings({}).selection_window_position,
    "last_word",
  );
  assert.equal(
    globalThis.normalizeSettings({ selection_window_position: "center" })
      .selection_window_position,
    "center",
  );
  for (const value of [null, "auto", "cursor", 42]) {
    assert.equal(
      globalThis.normalizeSettings({ selection_window_position: value })
        .selection_window_position,
      "last_word",
    );
  }
});
