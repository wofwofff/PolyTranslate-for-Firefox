# Contributing

## Development

This is a Manifest V3 WebExtension. Firefox uses the `background.scripts`
fallback; Chromium browsers use `background.service_worker`.

Use Node.js 24 LTS, as specified in `.node-version`. Tests also run on Node.js
22 and 26 in CI. Install development dependencies:

```sh
npm install
```

Before submitting changes, run:

```sh
npm run lint
npm test
npm run format:check
npm run lint:firefox
npm run build:firefox
```

The Firefox lint command validates the staged Firefox extension using Mozilla's
`web-ext` and addons-linter, treating warnings as errors. The build command only
assembles the ZIP. Both commands use the same Firefox source preparation.
Use `npm run format` to format files.

The settings page follows the [Acorn UI guidelines](docs/acorn.md).

## Local Firefox setup

1. Clone the repository:

   ```sh
   git clone https://github.com/wofwofff/PolyTranslate-for-Firefox.git
   ```

2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on** and select the repository's `manifest.json`.
4. Open `about:addons`, select the extension, and open **Preferences**.

After editing files, use **Reload** on the extension's `about:debugging` card and
refresh the page being checked.

This development installation lasts until Firefox exits. For permanent
installation from a signed package, see the
[installation instructions](README.md#local-installation).

## GitHub Actions

`CI` runs separate jobs for ESLint, Prettier, tests on Node.js 22/24/26, and
Firefox validation. `Firefox ZIP` runs after all checks pass and uploads an
unsigned archive as an Actions artifact, retained for 14 days.

`CodeQL` analyzes JavaScript and GitHub Actions separately on pushes and pull
requests to `main`, and weekly. Workflow dependencies are pinned to commit SHAs;
Dependabot checks GitHub Actions and npm dependencies weekly.

`Release ZIP` runs on `v*` tags or manually. It checks that the manifest, npm
package, and lockfile versions agree; a tag must be exactly `v<manifest version>`.
It then reuses the CI workflow to produce the same unsigned ZIP. Download it from
the workflow run's **Artifacts** section. This workflow does not sign XPI files,
publish to AMO, or require AMO credentials.

For branch protection, require `ESLint`, `Prettier`, each `Tests (Node …)` job,
`Firefox validation`, `Firefox ZIP`, and both `CodeQL (…)` checks after their first
successful run.

## Firefox package and signing

Validate and build the Firefox submission archive:

```sh
npm run lint:firefox
npm run build:firefox
```

The unsigned ZIP is written to `web-ext-artifacts/`. It includes the extension
files, license, attribution, and privacy information. The Firefox manifest in
the archive omits Chromium-only background settings.

Submit the ZIP through the [Mozilla Developer Hub](https://addons.mozilla.org/developers/addon/submit/agreement).
Choose **On your own** for signing without a public Add-ons listing, then download
the signed `.xpi` from the submitted version's page.

The fork's extension ID is `polytranslate@wofwofff`. Keep it for future versions
and increase the manifest version before submitting an update. See Mozilla's
[submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/).
