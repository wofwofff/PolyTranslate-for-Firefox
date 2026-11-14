import { translationPosition } from "./translation_position.js";

const STATE_KEY = "translation_windows";
let pending = Promise.resolve();

// Serialize window events with creation so early focus events cannot close a
// popup before it has appeared. Session storage survives MV3 background unloads.
function enqueue(operation) {
  const result = pending.then(operation);
  pending = result.catch((error) => {
    console.error("Failed to manage translation windows:", error);
  });
  return result;
}

async function getWindows() {
  const state = await chrome.storage.session.get({ [STATE_KEY]: [] });
  return state[STATE_KEY];
}

async function saveWindows(windows) {
  await chrome.storage.session.set({ [STATE_KEY]: windows });
}

async function closeWindows(windows) {
  for (const window of windows) {
    try {
      await chrome.windows.remove(window.id);
    } catch (error) {
      // The user may have closed the popup while its focus event was queued.
      const stillOpen = await chrome.windows.get(window.id).catch(() => null);
      if (stillOpen) {
        throw error;
      }
    }
  }
}

async function closeReturnedWindows(windowId) {
  const windows = await getWindows();
  const closing = windows.filter(
    (window) => window.sourceWindowId === windowId,
  );
  if (!closing.length) {
    return;
  }

  // Some platforms emit WINDOW_ID_NONE between two real focus events; a queued
  // event may also describe a window that has already lost focus again.
  const focused = await chrome.windows.getLastFocused();
  if (!focused.focused || focused.id !== windowId) {
    return;
  }

  await closeWindows(closing);
  await saveWindows(windows.filter((window) => !closing.includes(window)));
}

export function openTranslationWindow(url, settings, sourceTab, anchor) {
  return enqueue(async () => {
    const sourceWindowId = sourceTab?.windowId;
    const width = Math.round(settings.window_width);
    const height = Math.round(settings.window_height);
    const tabZoom =
      anchor?.scaleWithTabZoom && Number.isInteger(sourceTab?.id)
        ? await chrome.tabs.getZoom(sourceTab.id).catch(() => 1)
        : 1;
    const popup = await chrome.windows.create({
      url,
      type: "popup",
      focused: true,
      width,
      height,
      ...translationPosition(anchor, width, height, tabZoom),
      ...(typeof sourceTab?.incognito === "boolean"
        ? { incognito: sourceTab.incognito }
        : {}),
    });

    if (
      settings.close_on_return !== false &&
      Number.isInteger(sourceWindowId) &&
      sourceWindowId >= 0
    ) {
      const windows = await getWindows();
      windows.push({ id: popup.id, sourceWindowId });
      await saveWindows(windows);
      // Reconcile focus if the user returned before windows.create resolved.
      await closeReturnedWindows(sourceWindowId);
    }
    return popup;
  });
}

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    void enqueue(() => closeReturnedWindows(windowId));
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  void enqueue(async () => {
    const windows = await getWindows();
    const children = windows.filter(
      (window) => window.sourceWindowId === windowId,
    );
    await closeWindows(children);
    await saveWindows(
      windows.filter(
        (window) =>
          window.id !== windowId && window.sourceWindowId !== windowId,
      ),
    );
  });
});
