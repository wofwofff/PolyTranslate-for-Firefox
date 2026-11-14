const DEFAULT_SETTINGS = globalThis.DEFAULT_SETTINGS;

const form = document.querySelector("form");
const widthInput = document.querySelector("#window_width");
const heightInput = document.querySelector("#window_height");
const iconInput = document.querySelector("#show_icon");
const closeOnReturnInput = document.querySelector("#close_on_return");
const sizeFields = document.querySelector("#window-size");
const positionFields = document.querySelector("#icon-position");
const saveButton = document.querySelector("#save");
const status = document.querySelector("#settings-status");
const dimensionInputs = [widthInput, heightInput];
const inputs = Array.from(document.querySelectorAll("input"));
let savedDimensions = {
  window_width: DEFAULT_SETTINGS.window_width,
  window_height: DEFAULT_SETTINGS.window_height,
};

function showStatus(messageKey, isError = false) {
  status.textContent = chrome.i18n.getMessage(messageKey);
  status.dataset.error = String(isError);
}

function clearFieldError(input) {
  input.removeAttribute("aria-invalid");
  const error = document.querySelector(
    input.id === "window_width" ? "#width-error" : "#height-error",
  );
  error.textContent = "";
  error.hidden = true;
}

function validateDimension(input) {
  clearFieldError(input);
  if (
    input.disabled ||
    sizeFields.disabled ||
    (input.validity.valid &&
      globalThis.isValidDimension(input.name, input.valueAsNumber))
  ) {
    return true;
  }
  const error = document.querySelector(
    input.id === "window_width" ? "#width-error" : "#height-error",
  );
  error.textContent = chrome.i18n.getMessage("dimensionInvalid", [
    input.min,
    input.max,
  ]);
  error.hidden = false;
  input.setAttribute("aria-invalid", "true");
  return false;
}

function updateAvailability() {
  sizeFields.disabled = form.elements.target.value !== "window";
  positionFields.disabled = !iconInput.checked;
  if (sizeFields.disabled) {
    dimensionInputs.forEach(clearFieldError);
  }
}

function applySettings(settings) {
  widthInput.value = settings.window_width;
  heightInput.value = settings.window_height;
  form.elements.target.value = settings.target === "tab" ? "tab" : "window";
  form.elements.icon_position.value =
    settings.icon_position === "cursor" ? "cursor" : "selection";
  iconInput.checked = settings.show_icon;
  closeOnReturnInput.checked = settings.close_on_return !== false;
  updateAvailability();
}

async function restoreOptions() {
  saveButton.disabled = true;
  inputs.forEach((input) => {
    input.disabled = true;
  });
  try {
    const settings = globalThis.normalizeSettings(
      await chrome.storage.sync.get(DEFAULT_SETTINGS),
    );
    savedDimensions = {
      window_width: settings.window_width,
      window_height: settings.window_height,
    };
    applySettings(settings);
  } catch (error) {
    console.error("Failed to restore extension settings:", error);
    showStatus("settingsLoadFailed", true);
  } finally {
    inputs.forEach((input) => {
      input.disabled = false;
    });
    updateAvailability();
    saveButton.disabled = false;
  }
}

async function saveOptions(event) {
  event.preventDefault();
  if (saveButton.disabled) {
    return;
  }
  const validity = dimensionInputs.map(validateDimension);
  const invalidIndex = validity.indexOf(false);
  if (invalidIndex !== -1) {
    dimensionInputs[invalidIndex].focus();
    return;
  }

  const dimensions = sizeFields.disabled
    ? savedDimensions
    : {
        window_width: widthInput.valueAsNumber,
        window_height: heightInput.valueAsNumber,
      };
  saveButton.disabled = true;
  form.setAttribute("aria-busy", "true");
  showStatus("settingsSaving");
  try {
    await chrome.storage.sync.set({
      ...dimensions,
      target: form.elements.target.value,
      show_icon: iconInput.checked,
      close_on_return: closeOnReturnInput.checked,
      icon_position: form.elements.icon_position.value,
    });
    savedDimensions = { ...dimensions };
    showStatus("settingsSaved");
  } catch (error) {
    console.error("Failed to save extension settings:", error);
    showStatus("settingsSaveFailed", true);
  } finally {
    saveButton.disabled = false;
    form.removeAttribute("aria-busy");
  }
}

form.addEventListener("submit", saveOptions);
form.addEventListener("change", updateAvailability);
form.addEventListener("input", (event) => {
  status.textContent = "";
  if (
    dimensionInputs.includes(event.target) &&
    event.target.hasAttribute("aria-invalid")
  ) {
    validateDimension(event.target);
  }
});
dimensionInputs.forEach((input) => {
  const limits = globalThis.DIMENSION_LIMITS[input.name];
  input.min = String(limits.min);
  input.max = String(limits.max);
  input.addEventListener("blur", () => validateDimension(input));
});
applySettings(DEFAULT_SETTINGS);
restoreOptions();
