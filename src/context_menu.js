import "./defaults.js";
import { openTranslationWindow } from "./translation_window.js";

const contextMenuId = "translate-selection";
let menuUpdates = Promise.resolve();

const domainLocales = new Map([
  ["en", "com"],
  ["ru", "ru"],
]);

async function openTranslation(text, sourceTab, anchor) {
  if (typeof text !== "string" || !text.trim()) {
    throw new TypeError("Translation text must be a non-empty string");
  }

  const acceptedLanguages = await chrome.i18n.getAcceptLanguages();

  const supportedLanguage =
    acceptedLanguages
      .map((language) => language.split("-")[0])
      .find((language) => domainLocales.has(language)) || "en";

  const settings = globalThis.normalizeSettings(
    await chrome.storage.sync.get(globalThis.DEFAULT_SETTINGS),
  );
  const domainLocale = domainLocales.get(supportedLanguage);
  const encodedText = encodeURIComponent(text);
  const url =
    settings.provider === "google"
      ? `https://translate.google.com/?sl=auto&text=${encodedText}&op=translate`
      : `https://translate.yandex.${domainLocale}/?text=${encodedText}`;

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

async function lookUpTranslation(info, tab) {
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

async function createContextMenu() {
  const settings = globalThis.normalizeSettings(
    await chrome.storage.sync.get(globalThis.DEFAULT_SETTINGS),
  );
  await chrome.contextMenus.removeAll();
  await new Promise((resolve, reject) => {
    chrome.contextMenus.create(
      {
        id: contextMenuId,
        title: `${chrome.i18n.getMessage(
          settings.provider === "google" ? "providerGoogle" : "providerYandex",
        )}: %s`,
        contexts: ["selection"],
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      },
    );
  });
}

function updateContextMenu() {
  menuUpdates = menuUpdates.then(createContextMenu).catch((error) => {
    console.error("Failed to update translation context menu:", error);
  });
  return menuUpdates;
}

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

chrome.runtime.onInstalled.addListener(updateContextMenu);
chrome.runtime.onStartup.addListener(updateContextMenu);
chrome.contextMenus.onClicked.addListener(lookUpTranslation);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.provider) {
    return updateContextMenu();
  }
});
