# Settings UI and Acorn

The extension implements the Acorn components with accessible HTML and local CSS.
Firefox's internal `moz-*` elements require a privileged browser document and
cannot be imported by a Manifest V3 options page.

## Applied guidelines

- [Browser settings](https://acorn.firefox.com/latest/desktop/patterns/browser-settings-txAMsYCR):
  short groups of related settings, vertical choices, nested dependent settings.
- [Typography](https://acorn.firefox.com/latest/desktop/design-tokens/typography-Yo8yPRYS):
  `message-box`, 15 px body text, default line height, 22 px page heading,
  17 px section headings, 590 heading and button weight.
- [Fieldset](https://acorn.firefox.com/latest/desktop/components/fieldset-m2O6eYdW):
  native fieldsets with visible legends and associated descriptions. Disabled
  groups retain their legends; labels and descriptions are deemphasized.
- [Radio Group](https://acorn.firefox.com/latest/desktop/components/radio-group-A9fsJE6U):
  mutually exclusive, visible choices, defaults first, native arrow-key behavior.
- [Checkbox](https://acorn.firefox.com/latest/desktop/components/checkbox-535kxbzV):
  a labeled configuration checkbox, applied with the Save action.
- [Input Text](https://acorn.firefox.com/latest/desktop/components/input-text-ra2bnWyU):
  persistent labels, related fields grouped together, pixel units explained,
  integer constraints, inline errors connected through `aria-describedby` and
  `aria-invalid`. Invalid submission focuses the first invalid field.
- [Button](https://acorn.firefox.com/latest/desktop/components/button-gsFv3Uj9):
  one primary Save action, hover/active/focus/disabled states, pending state
  prevents duplicate submissions.
- [Space](https://acorn.firefox.com/latest/desktop/design-tokens/space-UO7Lv9Lr):
  2/4/8/12/16/24/32 px tokens; 32 px inputs and button, 16 px radio/checkbox.
- Light/dark tokens, system accent colors, explicit Firefox card surface colors,
  visible keyboard focus, explicit forced-colors palette, wrapping labels and
  responsive dimensions. No animation is needed for these controls.
- Save and storage failure feedback uses an atomic polite live region. Disabled
  window dimensions retain their last saved values when saving tab mode.
- The window-only group includes an autoclose preference. It is disabled in tab
  mode, retains its value, and applies to newly opened translation windows.

## Scope

Only applicable Acorn components are used. This page does not need navigation,
search, dialogs, icons, tables, or a reset action for a large configuration set.
Matching Firefox's Details card is a separate layout requirement: the embedded
options viewport is narrower than that card. Extension styles cannot paint past
its viewport or alter `about:addons`. There are no profile CSS overrides.

## Development checks

Run the [development checks](../CONTRIBUTING.md#development).
When checking the UI, load the real extension in a temporary Firefox profile;
verify light/dark/forced-colors modes, English and Russian labels, 280/320/668 px
content viewports, keyboard focus and radio navigation, field validation,
dependent controls, and storage restoration. Check the content viewport width,
since Firefox may clamp its outer window to a larger minimum width.
