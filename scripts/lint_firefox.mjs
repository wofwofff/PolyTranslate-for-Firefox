import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { firefoxLintResult } from "./firefox_lint.mjs";
import { webExt, withFirefoxSource } from "./firefox_source.mjs";

await withFirefoxSource(async (stage) => {
  const result = spawnSync(
    process.execPath,
    [
      webExt,
      "lint",
      "--source-dir",
      stage,
      "--warnings-as-errors",
      "--no-config-discovery",
      "--output",
      "json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const manifest = JSON.parse(
    await readFile(join(stage, "manifest.json"), "utf8"),
  );
  const report = firefoxLintResult(result, manifest);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length || report.warnings.length) {
    process.exitCode = 1;
  }
});
