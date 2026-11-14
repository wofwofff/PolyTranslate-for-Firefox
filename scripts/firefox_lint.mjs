import assert from "node:assert/strict";

export function firefoxLintResult(result, manifest) {
  if (result.error) {
    throw result.error;
  }
  assert.equal(result.signal, null, "Firefox lint was interrupted");
  assert.ok(
    result.status === 0 || result.status === 1,
    `Firefox lint exited with status ${result.status}`,
  );

  const report = JSON.parse(result.stdout);
  for (const key of ["errors", "warnings", "notices"]) {
    assert.ok(Array.isArray(report[key]), `Missing lint ${key}`);
    assert.equal(report.summary[key], report[key].length);
  }
  assert.ok(
    result.status === 0 || report.errors.length + report.warnings.length > 0,
    "Firefox lint failed without diagnostics",
  );

  // addons-linter checks Android compatibility even for desktop-only manifests.
  const ignoredWarnings = report.warnings.filter(
    (warning) =>
      !Object.hasOwn(manifest.browser_specific_settings, "gecko_android") &&
      warning.code === "KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION" &&
      warning.file === "manifest.json",
  );
  return {
    errors: report.errors,
    warnings: report.warnings.filter(
      (warning) => !ignoredWarnings.includes(warning),
    ),
    notices: report.notices,
    ignoredWarnings,
  };
}
