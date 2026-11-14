import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [manifest, pkg, lock] = await Promise.all([
  readFile(new URL("../manifest.json", import.meta.url), "utf8").then(
    JSON.parse,
  ),
  readFile(new URL("../package.json", import.meta.url), "utf8").then(
    JSON.parse,
  ),
  readFile(new URL("../package-lock.json", import.meta.url), "utf8").then(
    JSON.parse,
  ),
]);
assert.equal(
  pkg.version,
  manifest.version,
  "package.json and manifest.json versions must match",
);
assert.equal(
  lock.version,
  pkg.version,
  "package-lock.json version must match package.json",
);
assert.equal(
  lock.packages[""].version,
  pkg.version,
  "Root lockfile package version must match package.json",
);
if (process.env.GITHUB_REF_TYPE === "tag") {
  assert.equal(
    process.env.GITHUB_REF_NAME,
    `v${manifest.version}`,
    "Release tag must match the manifest version",
  );
}
console.log(`Release version: ${manifest.version}`);
