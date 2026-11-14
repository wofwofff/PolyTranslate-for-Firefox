import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setImmediate } from "node:timers/promises";

function event() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
  };
}

export async function backgroundFixture(t, options = {}) {
  await setImmediate();
  const directory = await mkdtemp(join(tmpdir(), "polytranslate-review-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "package.json"), '{"type":"module"}');
  for (const name of [
    "context_menu.js",
    "translation_window.js",
    "translation_position.js",
    "defaults.js",
  ]) {
    await writeFile(
      join(directory, name),
      await readFile(new URL(`../../src/${name}`, import.meta.url)),
    );
  }
  const messages = event();
  const clicked = event();
  const createdTabs = [];
  const createdWindows = [];
  let focusedWindowId = 7;
  const api = {
    i18n: {
      async getAcceptLanguages() {
        focusedWindowId = options.focusAfterLookup ?? focusedWindowId;
        return options.languages ?? ["ru-RU", "en-US"];
      },
      getMessage(key) {
        return key;
      },
    },
    runtime: { onMessage: messages, onInstalled: event(), lastError: null },
    storage: {
      sync: {
        async get(defaults) {
          return { ...defaults, target: "tab", ...options.settings };
        },
      },
      session: {
        async get(defaults) {
          return structuredClone(defaults);
        },
        async set() {},
      },
    },
    tabs: {
      async create(properties) {
        if (options.rejectCreation) throw new Error("Creation rejected");
        const tab = {
          id: 99,
          windowId: properties.windowId ?? focusedWindowId,
          ...properties,
        };
        createdTabs.push(tab);
        return tab;
      },
      async sendMessage() {
        return { anchor: null };
      },
    },
    windows: {
      onFocusChanged: event(),
      onRemoved: event(),
      WINDOW_ID_NONE: -1,
      async create(properties) {
        if (options.rejectCreation) throw new Error("Creation rejected");
        createdWindows.push(properties);
        return { id: 90, ...properties };
      },
      async getLastFocused() {
        return { id: 90, focused: true };
      },
    },
    contextMenus: {
      onClicked: clicked,
      removeAll(callback) {
        callback();
      },
      create(_properties, callback) {
        callback?.();
      },
    },
  };
  globalThis.chrome = api;
  t.mock.method(console, "error", () => {});
  return {
    api,
    createdTabs,
    createdWindows,
    load() {
      return import(pathToFileURL(join(directory, "context_menu.js")));
    },
    async message(
      message,
      sourceTab = { id: 3, windowId: 7, incognito: false },
    ) {
      return new Promise((resolve, reject) => {
        const result = messages.listeners[0](
          message,
          { tab: sourceTab },
          resolve,
        );
        if (result !== true)
          reject(new Error("Listener did not keep response channel open"));
      });
    },
    unhandled(message) {
      return messages.listeners[0](message, {}, () => {
        throw new Error("Unexpected response");
      });
    },
  };
}
