import { execFileSync } from "node:child_process";
import { webExt, withFirefoxSource } from "./firefox_source.mjs";

await withFirefoxSource((stage) => {
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
});
