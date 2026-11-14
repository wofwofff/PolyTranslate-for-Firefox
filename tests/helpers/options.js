import { readFile } from "node:fs/promises";
import vm from "node:vm";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function optionsFixture({
  settings = {},
  deferLoad = false,
  deferSave = false,
  failLoad = false,
  failSave = false,
} = {}) {
  const html = await readFile(
    new URL("../../src/options.html", import.meta.url),
    "utf8",
  );
  const nodes = new Map();
  function node(id) {
    const events = new Map();
    const attributes = new Map();
    const inputMarkup =
      html.match(new RegExp(`<input\\b[^>]*id="${id}"[^>]*>`))?.[0] ?? "";
    const minimum = inputMarkup.match(/min="([^"]+)"/)?.[1];
    const maximum = inputMarkup.match(/max="([^"]+)"/)?.[1];
    let value = "";
    const result = {
      id,
      name: id,
      min: minimum,
      max: maximum,
      disabled: false,
      checked: false,
      dataset: {},
      textContent: "",
      hidden: false,
      get value() {
        return value;
      },
      set value(next) {
        value = String(next);
      },
      get valueAsNumber() {
        return value === "" ? NaN : Number(value);
      },
      // HTML number inputs accept integral finite values when no max is set.
      get validity() {
        const n = this.valueAsNumber;
        return {
          valid:
            Number.isFinite(n) &&
            Number.isInteger(n) &&
            n >= Number(minimum) &&
            (maximum === undefined || n <= Number(maximum)),
        };
      },
      addEventListener(name, callback) {
        events.set(name, callback);
      },
      emit(name, event = {}) {
        return events.get(name)?.({ preventDefault() {}, ...event });
      },
      setAttribute(name, next) {
        attributes.set(name, next);
      },
      removeAttribute(name) {
        attributes.delete(name);
      },
      hasAttribute(name) {
        return attributes.has(name);
      },
      focus() {
        this.focused = true;
      },
    };
    nodes.set(id, result);
    return result;
  }
  const form = node("settings-form");
  form.elements = {
    target: { value: "window" },
    icon_position: { value: "selection" },
  };
  for (const id of [
    "window_width",
    "window_height",
    "show_icon",
    "close_on_return",
    "window-size",
    "icon-position",
    "save",
    "settings-status",
    "width-error",
    "height-error",
    "window",
    "tab",
    "icon-near-selection",
    "icon-near-cursor",
  ])
    node(id);
  const loading = deferred();
  const saving = deferred();
  let stored = { ...settings };
  const writes = [];
  const context = vm.createContext({
    document: {
      querySelectorAll(selector) {
        if (selector !== "input")
          throw new Error(`Unexpected selector: ${selector}`);
        return [...html.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g)].map(
          (match) => nodes.get(match[1]),
        );
      },
      querySelector(selector) {
        return selector === "form" ? form : nodes.get(selector.slice(1));
      },
    },
    chrome: {
      i18n: { getMessage: (key) => key },
      storage: {
        sync: {
          async get(defaults) {
            if (deferLoad) await loading.promise;
            if (failLoad) throw new Error("Storage unavailable");
            return { ...defaults, ...stored };
          },
          async set(next) {
            writes.push(structuredClone(next));
            if (deferSave) await saving.promise;
            if (failSave) throw new Error("Storage quota exceeded");
            stored = { ...stored, ...next };
          },
        },
      },
    },
    console: { error() {} },
  });
  vm.runInContext(
    await readFile(new URL("../../src/defaults.js", import.meta.url), "utf8"),
    context,
  );
  vm.runInContext(
    await readFile(new URL("../../src/options.js", import.meta.url), "utf8"),
    context,
  );
  async function settle() {
    for (let n = 0; n < 5; n++) await Promise.resolve();
  }
  await settle();
  return {
    form,
    writes,
    nodes,
    get stored() {
      return stored;
    },
    async load() {
      loading.resolve();
      await settle();
    },
    async finishSave() {
      saving.resolve();
      await settle();
    },
    save: () => form.emit("submit"),
    edit(id, value) {
      const input = nodes.get(id);
      input.value = value;
      form.emit("input", { target: input });
    },
  };
}
