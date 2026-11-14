import "./defaults.js";
import { openTranslationWindow } from "./translation_window.js";

const contextMenuId = "yandex-translate";

const domainLocales = new Map([
  ["en", "com"],
  ["ru", "ru"],
]);

/**
 * Open translation for the given text
 * @param {string} text - Text to translate
 */
async function openTranslation(text, sourceTab, anchor) {
  if (typeof text !== "string" || !text.trim()) {
    throw new TypeError("Translation text must be a non-empty string");
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

  const settings = globalThis.normalizeSettings(
    await chrome.storage.sync.get(globalThis.DEFAULT_SETTINGS),
  );

  if (settings.target === "tab") {
    await chrome.tabs.create({
      url,
      ...(Number.isInteger(sourceTab?.windowId) && sourceTab.windowId >= 0
        ? { windowId: sourceTab.windowId }
        : {}),
    });
  } else {
    await openTranslationWindow(url, settings, sourceTab, anchor);
  }
}

async function lookUpYandexTranslate(info, tab) {
  if (!info || info.menuItemId !== contextMenuId) {
    return;
  }

  try {
    // The native menu API has no pointer coordinates. Ask the content script
    // in the frame where the menu was opened; restricted pages fall back safely.
    const position =
      tab?.id === undefined
        ? null
        : await chrome.tabs
            .sendMessage(
              tab.id,
              { action: "getTranslationAnchor" },
              { frameId: info.frameId ?? 0 },
            )
            .catch(() => null);
    await openTranslation(info.selectionText, tab, position?.anchor);
  } catch (error) {
    console.error("Failed to open translation from context menu:", error);
  }
}

function init() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error(
        "Failed to clear extension context menus:",
        chrome.runtime.lastError,
      );
      return;
    }

    chrome.contextMenus.create(
      {
        id: contextMenuId,
        title: `${chrome.i18n.getMessage("contextMenuTitle")}: %s`,
        contexts: ["selection"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to create translation context menu:",
            chrome.runtime.lastError,
          );
        }
      },
    );
  });
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== "translateSelection") {
    return false;
  }

  openTranslation(message.text, sender.tab, message.anchor)
    .then(() => sendResponse({ success: true }))
    .catch((error) => {
      console.error("Failed to open translation:", error);
      sendResponse({ success: false });
    });

  return true; // Keep message channel open for async response
});

chrome.runtime.onInstalled.addListener(init);
chrome.contextMenus.onClicked.addListener(lookUpYandexTranslate);
