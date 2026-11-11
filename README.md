<p align="center">
  <img src="./assets/icons/icon-96.png" width="96" height="96" alt="PolyTranslate icon">
</p>

# PolyTranslate for Firefox

[![Firefox 140+](https://img.shields.io/badge/Firefox-140%2B-FF7139?logo=firefoxbrowser&logoColor=white)](#requirements)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-0060DF)](manifest.json)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue)](LICENSE)
[![Firefox Add-ons: coming soon](https://img.shields.io/badge/Firefox_Add--ons-coming_soon-9059FF?logo=firefoxbrowser&logoColor=white)](#firefox-add-ons)

Translate selected text with Yandex Translate from Firefox's context menu or a
selection icon. Translations open in a separate window or a new tab.

## Features

- Show an optional translation icon next to selected text or the cursor.
- Configure translation window dimensions.
- Configure the extension through an Acorn-styled settings page.
- Use the interface in English or Russian.
- No API key required: translations open on the Yandex Translate website.

## Installation

### Requirements

Firefox Desktop **140 or later**.

### Firefox Add-ons

Publication of this fork on **Firefox Add-ons is planned for the near future**.
For now, you can install it locally using the instructions below.

### Local installation

Install a **Mozilla-signed `.xpi`** locally:

1. Save the signed `.xpi` file on your computer.
2. Open `about:addons` in Firefox.
3. Open the gear menu and select **Install Add-on From File…**.
4. Select the `.xpi` file and confirm installation.

The extension remains installed after restarting Firefox. A public Firefox
Add-ons listing is not required for this installation method.

A signed package is not included in this source checkout. Standard Firefox
requires Mozilla signing for permanent installation; renaming a ZIP to `.xpi`
does not sign it. See Mozilla's
[self-distribution documentation](https://extensionworkshop.com/documentation/publish/self-distribution/).

To load the source during development, see
[CONTRIBUTING.md](CONTRIBUTING.md#local-firefox-setup).

## Usage

1. Select text on a regular web page.
2. Right-click and choose **Yandex Translate**, or click the translation icon
   next to the selection.
3. View the translation in the window or tab that opens.

To change the opening mode, window dimensions, or icon behavior, open
`about:addons`, select the extension, and open **Preferences**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and checks.

Report bugs and suggest improvements in the
[issue tracker](https://github.com/wofwofff/PolyTranslate-for-Firefox/issues).

## Roadmap

- Add keyboard shortcuts.
- Add source and target language preferences.
- Support full-page translation.

## Authors

See [AUTHORS.md](AUTHORS.md) for the original author and upstream repository.

## License

[Mozilla Public License 2.0](LICENSE).

See [PRIVACY.md](PRIVACY.md) for information about text sent for translation.
