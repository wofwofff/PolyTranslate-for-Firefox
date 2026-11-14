import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { backgroundFixture } from "./helpers/background.js";

test("encodes selected text and recognizes a regional language tag", async (t) => {
  const f = await backgroundFixture(t);
  await f.load();
  assert.deepEqual(
    await f.message({ action: "translateSelection", text: "a & b = <test>" }),
    { success: true },
  );
  const url = new URL(f.createdTabs[0].url);
  assert.equal(url.hostname, "translate.yandex.ru");
  assert.equal(url.searchParams.get("text"), "a & b = <test>");
});

test("unknown messages are left for other listeners", async (t) => {
  const f = await backgroundFixture(t);
  await f.load();
  assert.equal(f.unhandled({ action: "otherAction" }), false);
  assert.equal(f.createdTabs.length, 0);
});

test("creation failures are returned to the sender", async (t) => {
  const f = await backgroundFixture(t, { rejectCreation: true });
  await f.load();
  assert.deepEqual(
    await f.message({ action: "translateSelection", text: "hello" }),
    { success: false },
  );
});

test("tab mode keeps a private source in its original window after focus changes", async (t) => {
  const f = await backgroundFixture(t, { focusAfterLookup: 2 });
  await f.load();
  await f.message(
    { action: "translateSelection", text: "private text" },
    { id: 3, windowId: 7, incognito: true },
  );
  assert.equal(
    f.createdTabs[0].windowId,
    7,
    "translation must remain in the source private window, not focused normal window 2",
  );
});

test("invalid translation payloads do not receive a success response", async (t) => {
  const f = await backgroundFixture(t);
  await f.load();
  assert.deepEqual(
    await f.message({ action: "translateSelection", text: 42 }),
    { success: false },
  );
  assert.equal(f.createdTabs.length, 0);
});

test("invalid synced popup dimensions fall back to usable defaults", async (t) => {
  const f = await backgroundFixture(t, {
    settings: { target: "window", window_width: -10, window_height: null },
  });
  await f.load();
  await f.message({ action: "translateSelection", text: "hello" });
  assert.equal(f.createdWindows[0].width, 900);
  assert.equal(f.createdWindows[0].height, 650);
});

test("manifest advertises desktop support only", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../manifest.json", import.meta.url)),
  );
  assert.equal(manifest.browser_specific_settings.gecko_android, undefined);
  assert.equal(
    manifest.browser_specific_settings.gecko.strict_min_version,
    "140.0",
  );
});

test("a missing private source window fails without retrying in another window", async (t) => {
  const f = await backgroundFixture(t, { focusAfterLookup: 2 });
  const attempts = [];
  f.api.tabs.create = async (properties) => {
    attempts.push(properties);
    throw new Error("No window with id: 7");
  };
  await f.load();
  assert.deepEqual(
    await f.message(
      { action: "translateSelection", text: "private text" },
      { id: 3, windowId: 7, incognito: true },
    ),
    { success: false },
  );
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].windowId, 7);
});

test("blank and missing text fail without opening a translation", async (t) => {
  const f = await backgroundFixture(t);
  await f.load();
  for (const text of ["", " \n ", null, undefined]) {
    assert.deepEqual(await f.message({ action: "translateSelection", text }), {
      success: false,
    });
  }
  assert.equal(f.createdTabs.length, 0);
});

test("Google preserves selected text, autodetects the source and keeps the source window", async (t) => {
  const f = await backgroundFixture(t, {
    settings: { provider: "google" },
    focusAfterLookup: 2,
  });
  await f.load();
  const text = "Кот & dog + 雪? #100%";
  assert.deepEqual(
    await f.message(
      { action: "translateSelection", text },
      { id: 3, windowId: 7, incognito: true },
    ),
    { success: true },
  );
  const tab = f.createdTabs[0];
  const url = new URL(tab.url);
  assert.equal(url.origin, "https://translate.google.com");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(url.searchParams.get("sl"), "auto");
  assert.equal(url.searchParams.get("op"), "translate");
  assert.equal(url.searchParams.has("tl"), false);
  assert.equal(tab.windowId, 7);
});

test("Google popup uses the same configured dimensions and privacy as Yandex", async (t) => {
  const f = await backgroundFixture(t, {
    settings: {
      provider: "google",
      target: "window",
      window_width: 480,
      window_height: 420,
      close_on_return: false,
    },
  });
  await f.load();
  await f.message(
    { action: "translateSelection", text: "hello" },
    { id: 3, windowId: 7, incognito: true },
  );
  const popup = f.createdWindows[0];
  assert.equal(new URL(popup.url).hostname, "translate.google.com");
  assert.equal(popup.width, 480);
  assert.equal(popup.height, 420);
  assert.equal(popup.type, "popup");
  assert.equal(popup.incognito, true);
});

test("installation replaces the legacy menu with the default Yandex item", async (t) => {
  const f = await backgroundFixture(t);
  f.menuItems.push({ id: "yandex-translate", title: "Old menu" });
  await f.load();
  await f.install();
  assert.equal(f.menuItems.length, 1);
  assert.equal(f.menuItems[0].id, "translate-selection");
  assert.equal(f.menuItems[0].title, "providerYandex: %s");
});

test("saving Google updates the context menu and its click opens Google in the source frame", async (t) => {
  const f = await backgroundFixture(t);
  await f.load();
  await f.install();
  await f.changeSettings({
    provider: { oldValue: "yandex", newValue: "google" },
  });
  assert.equal(f.menuItems.length, 1);
  assert.equal(f.menuItems[0].title, "providerGoogle: %s");
  const messages = [];
  f.api.tabs.sendMessage = async (...args) => {
    messages.push(args);
    return { anchor: null };
  };
  await f.clickMenu(
    "hello & goodbye",
    { id: 3, windowId: 7, incognito: false },
    12,
  );
  assert.equal(new URL(f.createdTabs[0].url).hostname, "translate.google.com");
  assert.equal(
    new URL(f.createdTabs[0].url).searchParams.get("text"),
    "hello & goodbye",
  );
  assert.equal(messages[0][2].frameId, 12);
});

test("removing the provider setting restores Yandex for both menu and translation", async (t) => {
  const f = await backgroundFixture(t, { settings: { provider: "google" } });
  await f.load();
  await f.install();
  await f.changeSettings({ provider: { oldValue: "google" } });
  assert.equal(f.menuItems[0].title, "providerYandex: %s");
  await f.clickMenu("hello");
  assert.equal(new URL(f.createdTabs[0].url).hostname, "translate.yandex.ru");
});

test("browser startup restores the saved provider in the context menu", async (t) => {
  const f = await backgroundFixture(t, { settings: { provider: "google" } });
  await f.load();
  await f.startup();
  assert.equal(f.menuItems[0].title, "providerGoogle: %s");
});

test("unrelated settings and changes outside sync do not rebuild the menu", async (t) => {
  const f = await backgroundFixture(t);
  await f.load();
  await f.install();
  const original = f.menuItems[0];
  await f.changeSettings({ show_icon: { oldValue: true, newValue: false } });
  await f.changeSettings({ provider: { newValue: "google" } }, "local");
  assert.equal(f.menuItems[0], original);
});

test("an unsupported stored provider falls back to Yandex", async (t) => {
  const f = await backgroundFixture(t, {
    settings: { provider: "https://evil.test" },
  });
  await f.load();
  await f.install();
  await f.clickMenu("hello");
  assert.equal(f.menuItems[0].title, "providerYandex: %s");
  assert.equal(new URL(f.createdTabs[0].url).hostname, "translate.yandex.ru");
});

test("rapid provider changes leave one menu for the latest saved provider", async (t) => {
  const f = await backgroundFixture(t);
  await f.load();
  await f.install();
  const first = f.changeSettings({ provider: { newValue: "google" } });
  await Promise.resolve();
  const second = f.changeSettings({ provider: { newValue: "yandex" } });
  await Promise.all([first, second]);
  assert.equal(f.menuItems.length, 1);
  assert.equal(f.menuItems[0].title, "providerYandex: %s");
});

test("a failed menu creation does not block future provider updates", async (t) => {
  const f = await backgroundFixture(t);
  const create = f.api.contextMenus.create;
  let fail = true;
  f.api.contextMenus.create = (properties, callback) => {
    if (fail) {
      fail = false;
      f.api.runtime.lastError = { message: "Menu creation failed" };
      callback();
      f.api.runtime.lastError = null;
    } else create(properties, callback);
  };
  await f.load();
  await f.install();
  assert.equal(f.menuItems.length, 0);
  await f.changeSettings({ provider: { newValue: "google" } });
  assert.equal(f.menuItems.length, 1);
  assert.equal(f.menuItems[0].title, "providerGoogle: %s");
});
