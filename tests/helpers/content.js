import { readFile } from "node:fs/promises";
import vm from "node:vm";

function eventTarget() {
  const events = new Map();
  return {
    addEventListener(name, listener) {
      if (!events.has(name)) events.set(name, []);
      events.get(name).push(listener);
    },
    emit(name, value = {}) {
      for (const listener of events.get(name) ?? []) listener(value);
    },
  };
}

export async function contentFixture({
  settings = {},
  deferStorage = false,
  rect = { left: 100, top: 100, right: 300, bottom: 120 },
} = {}) {
  const frames = new Map();
  const elements = [];
  const state = {
    text: "selected text",
    rect,
    anchorOffset: 0,
    focusOffset: 13,
  };
  const changed = [];
  let frameId = 0;
  let restore;
  let root;
  function element(tag) {
    const node = {
      ...eventTarget(),
      tag,
      children: [],
      hidden: false,
      style: {},
      classList: {
        values: new Set(),
        add(value) {
          this.values.add(value);
        },
        remove(value) {
          this.values.delete(value);
        },
        contains(value) {
          return this.values.has(value);
        },
      },
      complete: true,
      naturalWidth: 48,
      setAttribute(name, value) {
        this[name] = value;
      },
      appendChild(child) {
        this.children.push(child);
        child.parent = this;
        return child;
      },
      querySelector(name) {
        return this.children.find((child) => child.tag === name);
      },
      contains(child) {
        return (
          child === this || this.children.some((node) => node.contains(child))
        );
      },
      attachShadow() {
        const shadow = element("shadow");
        shadow.host = this;
        return shadow;
      },
      get isConnected() {
        return (
          this === root ||
          !!(this.parent?.isConnected || this.host?.isConnected)
        );
      },
    };
    elements.push(node);
    return node;
  }
  root = element("html");
  const document = {
    ...eventTarget(),
    documentElement: root,
    readyState: "complete",
    createElement: element,
  };
  const context = vm.createContext({
    document,
    window: {
      innerWidth: 800,
      innerHeight: 600,
      mozInnerScreenX: 100,
      mozInnerScreenY: 100,
      screen: { availLeft: 0, availTop: 0, availWidth: 1366, availHeight: 768 },
      getSelection() {
        return {
          toString: () => state.text,
          anchorOffset: state.anchorOffset,
          focusOffset: state.focusOffset,
          rangeCount: state.text ? 1 : 0,
          getRangeAt: () => ({ getBoundingClientRect: () => state.rect }),
        };
      },
    },
    chrome: {
      runtime: {
        getURL: (path) => `moz-extension://test/${path}`,
        onMessage: { addListener() {} },
        sendMessage: async () => ({ success: true }),
      },
      i18n: { getMessage: (key) => key },
      storage: {
        sync: {
          get(defaults, callback) {
            restore = () => callback({ ...defaults, ...settings });
            if (!deferStorage) restore();
          },
        },
        onChanged: {
          addListener(callback) {
            changed.push(callback);
          },
        },
      },
    },
    requestAnimationFrame(callback) {
      frames.set(++frameId, callback);
      return frameId;
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    console: { error() {} },
  });
  vm.runInContext(
    await readFile(new URL("../../src/defaults.js", import.meta.url), "utf8"),
    context,
  );
  vm.runInContext(
    await readFile(new URL("../../src/content.js", import.meta.url), "utf8"),
    context,
  );
  function flush() {
    for (let n = 0; n < 10 && frames.size; n++) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    }
    elements
      .filter((node) => node.tag === "link")
      .forEach((node) => node.emit("load"));
    for (const callback of frames.values()) callback();
    frames.clear();
  }
  return {
    state,
    document,
    elements,
    restore: () => restore(),
    flush,
    select() {
      document.emit("mouseup", { button: 0, clientX: 700, clientY: 500 });
      flush();
    },
    change(changes) {
      changed.forEach((callback) => callback(changes, "sync"));
    },
    get icon() {
      return elements.find((node) => node.tag === "button");
    },
    get visible() {
      return !!this.icon?.classList.contains("translate-icon-visible");
    },
  };
}
