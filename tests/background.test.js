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
