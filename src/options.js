const DEFAULT_SETTINGS = globalThis.DEFAULT_SETTINGS;

function saveOptions(e) {
  e.preventDefault();

  chrome.storage.sync.set({
    window_width: parseInt(document.querySelector("#window_width").value),
    window_height: parseInt(document.querySelector("#window_height").value),
    target: document.querySelector("[name='target']:checked").id,
    show_icon: document.querySelector("#show_icon").checked,
    icon_position: document.querySelector("[name=icon_position]:checked").value,
  });
}

function restoreOptions() {
  function setCurrentChoice(result) {
    document.querySelector("#window_width").value = result.window_width;
    document.querySelector("#window_height").value = result.window_height;
    document.querySelector(`#${result.target}`).checked = true;
    document.querySelector("#show_icon").checked = result.show_icon;
    document.querySelector(
      `[name=icon_position][value="${result.icon_position}"]`,
    ).checked = true;
  }

  let getting = chrome.storage.sync.get(DEFAULT_SETTINGS);

  getting.then(setCurrentChoice, console.error);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
