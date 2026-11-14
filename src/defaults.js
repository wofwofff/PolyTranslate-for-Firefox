globalThis.DEFAULT_SETTINGS = Object.freeze({
  window_height: 650,
  window_width: 900,
  target: "window",
  provider: "yandex",
  close_on_return: true,
  show_icon: true,
  icon_position: "selection",
});

globalThis.DIMENSION_LIMITS = Object.freeze({
  window_width: Object.freeze({ min: 320, max: 32767 }),
  window_height: Object.freeze({ min: 240, max: 32767 }),
});

globalThis.isValidDimension = function (name, value) {
  const limits = globalThis.DIMENSION_LIMITS[name];
  return (
    !!limits &&
    Number.isSafeInteger(value) &&
    value >= limits.min &&
    value <= limits.max
  );
};

globalThis.normalizeSettings = function (values = {}) {
  values = values && typeof values === "object" ? values : {};
  const defaults = globalThis.DEFAULT_SETTINGS;
  const settings = { ...defaults };
  for (const name of Object.keys(globalThis.DIMENSION_LIMITS)) {
    if (globalThis.isValidDimension(name, values[name])) {
      settings[name] = values[name];
    }
  }
  for (const name of ["show_icon", "close_on_return"]) {
    if (typeof values[name] === "boolean") {
      settings[name] = values[name];
    }
  }
  if (values.target === "tab") {
    settings.target = "tab";
  }
  if (values.provider === "google") {
    settings.provider = "google";
  }
  if (values.icon_position === "cursor") {
    settings.icon_position = "cursor";
  }
  return settings;
};
