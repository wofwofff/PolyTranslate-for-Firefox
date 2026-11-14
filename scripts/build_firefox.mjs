import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { projectRoot, webExt, withFirefoxSource } from "./firefox_source.mjs";

await withFirefoxSource((stage) => {
  execFileSync(
    process.execPath,
    [
      webExt,
      "build",
      "--source-dir",
      stage,
      "--artifacts-dir",
      join(projectRoot, "web-ext-artifacts"),
      "--overwrite-dest",
      "--no-config-discovery",
    ],
    { stdio: "inherit" },
  );
});
