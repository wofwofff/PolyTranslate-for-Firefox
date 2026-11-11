# Contributing

## Development

This is a Manifest V3 WebExtension. Firefox uses the `background.scripts`
fallback; Chromium browsers use `background.service_worker`.

Install development dependencies:

```sh
npm install
```

Before submitting changes, run:

```sh
npm run lint
npm run format:check
npm run lint:firefox
```

The Firefox lint command uses Mozilla's `web-ext` and addons-linter.
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

## Firefox package and signing

Build and validate the Firefox submission archive:

```sh
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
