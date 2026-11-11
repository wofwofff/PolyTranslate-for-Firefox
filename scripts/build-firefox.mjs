import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const stage = await mkdtemp(join(tmpdir(), "polytranslate-firefox-"));
const webExt = join(root, "node_modules/web-ext/bin/web-ext.js");

try {
  for (const path of [
    "src",
    "assets",
    "_locales",
    "LICENSE",
    "AUTHORS.md",
    "PRIVACY.md",
  ]) {
    await cp(join(root, path), join(stage, path), { recursive: true });
  }

  const manifest = JSON.parse(
    await readFile(join(root, "manifest.json"), "utf8"),
  );
  // Firefox uses background scripts; keep the Chromium entry in the source manifest.
  delete manifest.background.service_worker;
  delete manifest.minimum_chrome_version;
  await writeFile(
    join(stage, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  execFileSync(
    process.execPath,
    [
      webExt,
      "lint",
      "--source-dir",
      stage,
      "--warnings-as-errors",
      "--no-config-discovery",
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      webExt,
      "build",
      "--source-dir",
      stage,
      "--artifacts-dir",
      join(root, "web-ext-artifacts"),
      "--overwrite-dest",
      "--no-config-discovery",
    ],
    { stdio: "inherit" },
  );
} finally {
  await rm(stage, { recursive: true, force: true });
}
