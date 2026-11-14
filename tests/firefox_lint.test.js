import assert from "node:assert/strict";
import test from "node:test";
import { firefoxLintResult } from "../scripts/firefox_lint.mjs";

const desktop = { browser_specific_settings: { gecko: {} } };
const androidWarning = {
  code: "KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION",
  file: "manifest.json",
};

function result({ errors = [], warnings = [], notices = [] } = {}) {
  return {
    status: errors.length || warnings.length ? 1 : 0,
    signal: null,
    stdout: JSON.stringify({
      errors,
      warnings,
      notices,
      summary: {
        errors: errors.length,
        warnings: warnings.length,
        notices: notices.length,
      },
    }),
  };
}

test("clean lint reports and notices pass without ignored warnings", () => {
  for (const notices of [[], [{ code: "NOTICE" }]]) {
    const report = firefoxLintResult(result({ notices }), desktop);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings, []);
    assert.deepEqual(report.notices, notices);
    assert.deepEqual(report.ignoredWarnings, []);
  }
});

test("desktop-only lint excludes Android minimum-version diagnostics", () => {
  const report = firefoxLintResult(
    result({ warnings: [androidWarning] }),
    desktop,
  );
  assert.deepEqual(report.warnings, []);
  assert.deepEqual(report.ignoredWarnings, [androidWarning]);
});

test("Android compatibility remains enforced when Android is declared", () => {
  for (const gecko_android of [{}, { strict_min_version: "140.0" }]) {
    const manifest = {
      browser_specific_settings: { gecko: {}, gecko_android },
    };
    const report = firefoxLintResult(
      result({ warnings: [androidWarning] }),
      manifest,
    );
    assert.deepEqual(report.warnings, [androidWarning]);
    assert.deepEqual(report.ignoredWarnings, []);
  }
});

test("desktop lint preserves other warnings, errors and notices", () => {
  const warning = { code: "KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION" };
  const wrongFile = { ...androidWarning, file: "src/content.js" };
  const error = { code: "MANIFEST_INVALID" };
  const notice = { code: "NOTICE" };
  const report = firefoxLintResult(
    result({
      warnings: [androidWarning, warning, wrongFile],
      errors: [error],
      notices: [notice],
    }),
    desktop,
  );
  assert.deepEqual(report.warnings, [warning, wrongFile]);
  assert.deepEqual(report.errors, [error]);
  assert.deepEqual(report.notices, [notice]);
});

test("tool failures and malformed reports cannot pass Firefox lint", () => {
  const error = new Error("Unable to start web-ext");
  assert.throws(() => firefoxLintResult({ error }, desktop), error);
  for (const change of [
    { signal: "SIGTERM" },
    { status: 2 },
    { status: null },
    { status: 1 },
    { stdout: "not JSON" },
    { stdout: JSON.stringify({}) },
    { stdout: JSON.stringify({ errors: [], warnings: [], notices: [] }) },
    {
      stdout: JSON.stringify({
        errors: [],
        warnings: [],
        notices: [],
        summary: { errors: 1, warnings: 0, notices: 0 },
      }),
    },
  ]) {
    assert.throws(() => firefoxLintResult({ ...result(), ...change }, desktop));
  }
});
