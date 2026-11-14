import assert from "node:assert/strict";
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
