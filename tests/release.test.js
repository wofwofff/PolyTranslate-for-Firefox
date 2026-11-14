import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, copyFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function release(
  t,
  {
    tag = "v1.4.1",
    refType = "tag",
    version = "1.4.1",
    packageVersion = "1.4.1",
    lockVersion = packageVersion,
  } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "polytranslate-release-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "scripts"));
  await copyFile(
    new URL("../scripts/check_release.mjs", import.meta.url),
    join(directory, "scripts/check_release.mjs"),
  );
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify({ version }),
  );
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ version: packageVersion }),
  );
  await writeFile(
    join(directory, "package-lock.json"),
    JSON.stringify({
      version: lockVersion,
      packages: { "": { version: lockVersion } },
    }),
  );
  return spawnSync(
    process.execPath,
    [join(directory, "scripts/check_release.mjs")],
    {
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, GITHUB_REF_TYPE: refType, GITHUB_REF_NAME: tag },
    },
  );
}

test("a release tag must exactly match the package version", async (t) => {
  const valid = await release(t);
  assert.equal(valid.status, 0, valid.stderr);
  for (const tag of ["v1.4.2", "v1.4.1-extra", "1.4.1"]) {
    const invalid = await release(t, { tag });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Release tag must match/);
  }
});

test("inconsistent manifest and package versions fail the release check", async (t) => {
  const result = await release(t, { packageVersion: "1.4.2" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /versions must match/);
});

test("an outdated lockfile fails the release check", async (t) => {
  const result = await release(t, { lockVersion: "1.4.0" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /lock.json version must match/);
});

test("manual branch builds validate versions without requiring a tag", async (t) => {
  const result = await release(t, { refType: "branch", tag: "main" });
  assert.equal(result.status, 0, result.stderr);
});
