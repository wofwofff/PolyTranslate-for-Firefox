import "./defaults.js";

const contextMenuId = "yandex-translate";

const domainLocales = new Map([
  ["en", "com"],
  ["ru", "ru"],
]);

/**
 * Open translation for the given text
 * @param {string} text - Text to translate
 */
async function openTranslation(text) {
  if (!text || typeof text !== "string") {
    return;
  }

  const acceptedLanguages = await chrome.i18n.getAcceptLanguages();

  const supportedLanguage =
    acceptedLanguages
      .map((language) => language.split("-")[0])
      .find((language) => domainLocales.has(language)) || "en";

  const domainLocale = domainLocales.get(supportedLanguage);
  const url = `https://translate.yandex.${domainLocale}/?text=${encodeURIComponent(
    text,
  )}`;

  const settings = await chrome.storage.sync.get(globalThis.DEFAULT_SETTINGS);

  if (settings.target === "tab") {
    await chrome.tabs.create({ url });
  } else {
    // Ensure integer dimensions
    await chrome.windows.create({
      url,
      type: "popup",
      width: Math.round(settings.window_width),
      height: Math.round(settings.window_height),
    });
  }
}

async function lookUpYandexTranslate(info) {
  if (!info || info.menuItemId !== contextMenuId) {
    return;
  }

  try {
    await openTranslation(info.selectionText);
  } catch (error) {
    console.error("Failed to open translation from context menu:", error);
  }
}

function init() {
  chrome.contextMenus.create({
    id: contextMenuId,
    title: "Yandex Translate: %s",
    contexts: ["selection"],
  });
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== "translateSelection") {
    return false;
  }

  openTranslation(message.text)
    .then(() => sendResponse({ success: true }))
    .catch((error) => {
      console.error("Failed to open translation:", error);
      sendResponse({ success: false });
    });

  return true; // Keep message channel open for async response
});

chrome.runtime.onInstalled.addListener(init);
chrome.contextMenus.onClicked.addListener(lookUpYandexTranslate);
