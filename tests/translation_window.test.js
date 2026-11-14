import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";

let moduleId = 0;
const settings = {
  window_width: 480,
  window_height: 500,
  close_on_return: true,
};

function event() {
  const listeners = new Set();
  return {
    addListener(listener) {
      listeners.add(listener);
    },
    emit(value) {
      for (const listener of listeners) listener(value);
    },
    clear() {
      listeners.clear();
    },
  };
}

async function setup() {
  const storage = {};
  const windows = new Map([
    [1, { id: 1, type: "normal" }],
    [2, { id: 2, type: "normal" }],
  ]);
  const focusChanged = event();
  const removed = event();
  const closed = [];
  const created = [];
  let focusedId = 1;
  let nextId = 10;
  const env = {
    windows,
    storage,
    closed,
    created,
    focus(id) {
      focusedId = id;
      focusChanged.emit(id);
    },
    afterCreate: null,
    beforeRemove: null,
    async reload() {
      focusChanged.clear();
      removed.clear();
      return import(`../src/translation_window.js?test=${++moduleId}`);
    },
  };
  globalThis.chrome = {
    storage: {
      session: {
        async get(defaults) {
          return structuredClone({ ...defaults, ...storage });
        },
        async set(values) {
          Object.assign(storage, structuredClone(values));
        },
      },
    },
    windows: {
      WINDOW_ID_NONE: -1,
      onFocusChanged: focusChanged,
      onRemoved: removed,
      async create(options) {
        const popup = { id: nextId++, type: options.type };
        windows.set(popup.id, popup);
        created.push(options);
        env.focus(-1);
        env.focus(popup.id);
        await env.afterCreate?.(popup);
        return { ...popup, focused: focusedId === popup.id };
      },
      async getLastFocused() {
        return { ...windows.get(focusedId), focused: windows.has(focusedId) };
      },
      async get(id) {
        if (!windows.has(id)) throw new Error("No window with id");
        return windows.get(id);
      },
      async remove(id) {
        env.beforeRemove?.(id);
        if (!windows.delete(id)) throw new Error("No window with id");
        closed.push(id);
        removed.emit(id);
      },
    },
  };
  return {
    ...env,
    api: await env.reload(),
    event: { removed, focusChanged },
    env,
  };
}

test("creates a focused popup with source privacy and configured dimensions", async () => {
  const e = await setup();
  await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
    incognito: true,
  });
  assert.deepEqual(e.created[0], {
    url: "about:blank",
    type: "popup",
    focused: true,
    width: 480,
    height: 500,
    incognito: true,
  });
  assert.deepEqual(e.closed, []);
});

test("closes only translation windows when returning to their source", async () => {
  const e = await setup();
  const popup = await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
  });
  e.windows.set(99, { id: 99, type: "popup" });
  e.focus(1);
  await setImmediate();
  assert.deepEqual(e.closed, [popup.id]);
  assert.ok(e.windows.has(1) && e.windows.has(2) && e.windows.has(99));
  assert.deepEqual(e.storage.translation_windows, []);
});

test("ignores NONE, popup focus, and unrelated browser windows", async () => {
  const e = await setup();
  const popup = await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
  });
  for (const id of [-1, popup.id, 2]) {
    e.focus(id);
    await setImmediate();
    assert.deepEqual(e.closed, []);
  }
});

test("ignores a stale source focus event when the popup has focus again", async () => {
  const e = await setup();
  const popup = await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
  });
  e.focus(1);
  e.focus(popup.id);
  await setImmediate();
  assert.deepEqual(e.closed, []);
});

test("honors the preference to keep the popup open", async () => {
  const e = await setup();
  await e.api.openTranslationWindow(
    "about:blank",
    { ...settings, close_on_return: false },
    { windowId: 1 },
  );
  e.focus(1);
  await setImmediate();
  assert.deepEqual(e.closed, []);
});

test("cleans up state after manual popup closure", async () => {
  const e = await setup();
  const popup = await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
  });
  await globalThis.chrome.windows.remove(popup.id);
  await setImmediate();
  e.focus(1);
  await setImmediate();
  assert.deepEqual(e.closed, [popup.id]);
  assert.deepEqual(e.storage.translation_windows, []);
});

test("closes children when their source window is removed", async () => {
  const e = await setup();
  const popup = await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
  });
  await globalThis.chrome.windows.remove(1);
  await setImmediate();
  assert.deepEqual(e.closed, [1, popup.id]);
  assert.ok(e.windows.has(2));
});

test("restores window associations after background reload", async () => {
  const e = await setup();
  const popup = await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
  });
  await setImmediate();
  await e.reload();
  e.focus(1);
  await setImmediate();
  assert.deepEqual(e.closed, [popup.id]);
});

test("handles return to source before creation resolves", async () => {
  const e = await setup();
  e.env.afterCreate = () => e.focus(1);
  const popup = await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
  });
  await setImmediate();
  assert.deepEqual(e.closed, [popup.id]);
});

test("preserves associations for concurrent popups from different windows", async () => {
  const e = await setup();
  const [first, second] = await Promise.all([
    e.api.openTranslationWindow("about:blank", settings, { windowId: 1 }),
    e.api.openTranslationWindow("about:blank", settings, { windowId: 2 }),
  ]);
  e.focus(1);
  await setImmediate();
  assert.deepEqual(e.closed, [first.id]);
  assert.ok(e.windows.has(second.id));
  e.focus(2);
  await setImmediate();
  assert.deepEqual(e.closed, [first.id, second.id]);
});

test("tolerates a manual close racing with automatic closure", async () => {
  const e = await setup();
  const popup = await e.api.openTranslationWindow("about:blank", settings, {
    windowId: 1,
  });
  e.env.beforeRemove = (id) => {
    e.windows.delete(id);
    e.event.removed.emit(id);
  };
  e.focus(1);
  await setImmediate();
  assert.ok(!e.windows.has(popup.id));
  assert.deepEqual(e.storage.translation_windows, []);
});

test("does not associate requests without a source with arbitrary windows", async () => {
  const e = await setup();
  await e.api.openTranslationWindow("about:blank", settings);
  e.focus(1);
  await setImmediate();
  assert.deepEqual(e.closed, []);
});

test("positions a popup using the source tab zoom without changing its size", async () => {
  const e = await setup();
  globalThis.chrome.tabs = {
    async getZoom(id) {
      assert.equal(id, 7);
      return 1.5;
    },
  };
  await e.api.openTranslationWindow(
    "about:blank",
    settings,
    { id: 7, windowId: 1 },
    {
      x: 200,
      y: 160,
      scaleWithTabZoom: true,
      screen: { left: 0, top: 0, width: 960, height: 600 },
    },
  );
  assert.equal(e.created[0].left, 312);
  assert.equal(e.created[0].top, 240);
  assert.equal(e.created[0].width, settings.window_width);
  assert.equal(e.created[0].height, settings.window_height);
});

test("preserves configured dimensions even if they exceed the available screen", async () => {
  const e = await setup();
  await e.api.openTranslationWindow(
    "about:blank",
    { ...settings, window_width: 900, window_height: 650 },
    { windowId: 1 },
    { x: 200, y: 160, screen: { left: 0, top: 0, width: 640, height: 480 } },
  );
  assert.equal(e.created[0].width, 900);
  assert.equal(e.created[0].height, 650);
  assert.equal(e.created[0].left, 8);
  assert.equal(e.created[0].top, 8);
});
