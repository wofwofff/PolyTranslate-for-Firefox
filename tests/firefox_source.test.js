import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { withFirefoxSource } from "../scripts/firefox_source.mjs";

test("Firefox staging keeps runtime files and removes Chromium-only manifest keys", async () => {
  let directory;
  await withFirefoxSource(async (stage) => {
    directory = stage;
    const manifest = JSON.parse(
      await readFile(join(stage, "manifest.json"), "utf8"),
    );
    assert.equal(manifest.background.service_worker, undefined);
    assert.equal(manifest.minimum_chrome_version, undefined);
    assert.deepEqual(manifest.background.scripts, ["src/context_menu.js"]);
    for (const file of [
      "src/context_menu.js",
      "src/options.html",
      "assets/icons/icon-48.png",
      "_locales/en/messages.json",
      "AUTHORS.md",
      "PRIVACY.md",
      "LICENSE",
    ]) {
      await access(join(stage, file));
    }
    for (const path of [
      "assets/icons/source",
      "assets/readme",
      ".github",
      "scripts",
      "tests",
      "node_modules",
    ]) {
      await assert.rejects(access(join(stage, path)), { code: "ENOENT" });
    }
  });
  await assert.rejects(access(directory), { code: "ENOENT" });
});

test("Firefox staging is cleaned up even when lint or build fails", async () => {
  let directory;
  await assert.rejects(
    withFirefoxSource((stage) => {
      directory = stage;
      throw new Error("Tool failed");
    }),
    /Tool failed/,
  );
  await assert.rejects(access(directory), { code: "ENOENT" });
});
