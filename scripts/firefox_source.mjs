import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export const webExt = join(projectRoot, "node_modules/web-ext/bin/web-ext.js");

const excludedAssets = new Set([
  join(projectRoot, "assets/icons/source"),
  join(projectRoot, "assets/readme"),
]);

export async function withFirefoxSource(operation) {
  const stage = await mkdtemp(join(tmpdir(), "polytranslate-firefox-"));
  try {
    for (const path of [
      "src",
      "assets",
      "_locales",
      "LICENSE",
      "AUTHORS.md",
      "PRIVACY.md",
    ]) {
      await cp(join(projectRoot, path), join(stage, path), {
        recursive: true,
        filter: (source) => !excludedAssets.has(source),
      });
    }
    const manifest = JSON.parse(
      await readFile(join(projectRoot, "manifest.json"), "utf8"),
    );
    delete manifest.background.service_worker;
    delete manifest.minimum_chrome_version;
    await writeFile(
      join(stage, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return await operation(stage);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
