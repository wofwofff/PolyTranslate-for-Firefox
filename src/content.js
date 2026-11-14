(function () {
  "use strict";

  try {
    const ICON_SIZE = 32;
    const ICON_MARGIN = 5;
    const ICON_PATH = chrome.runtime.getURL("assets/icons/icon-48.png");
    const ICON_STYLES_PATH = chrome.runtime.getURL("src/content.css");
    const DEFAULT_SETTINGS = globalThis.DEFAULT_SETTINGS;
    let currentIcon = null;
    let iconHost = null;
    let iconStylesLoaded = false;
    let iconIsVisible = false;
    let currentSelection = "";
    let currentWordRect = null;
    const wordSegmenter = new Intl.Segmenter(undefined, {
      granularity: "word",
    });
    let mouseX = 0;
    let mouseY = 0;
    let keyboardSelection = false;
    let contextMenuAnchor = null;
    let lastScreenScale = 1;
    let selectionFrame = null;
    let suppressIcon = false;
    let suppressTimer = null;
    let settingsLoaded = false;
    let lastSelectionState = null;
    const settingsOverrides = {};
    const settings = {
      show_icon: DEFAULT_SETTINGS.show_icon,
      icon_position: DEFAULT_SETTINGS.icon_position,
    };
    function createIcon() {
      const host = document.createElement("div");
      host.hidden = true;
      iconHost = host;

      const shadowRoot = host.attachShadow({ mode: "closed" });
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = ICON_STYLES_PATH;
      stylesheet.addEventListener("load", () => {
        if (iconHost !== host) {
          return;
        }
        iconStylesLoaded = true;
        host.hidden = false;
        revealIcon(currentIcon);
      });
      stylesheet.addEventListener("error", () => {
        console.error("Failed to load icon styles from", ICON_STYLES_PATH);
      });
      shadowRoot.appendChild(stylesheet);

      const icon = document.createElement("button");
      icon.type = "button";
      icon.className = "translate-icon";
      icon.setAttribute(
        "aria-label",
        chrome.i18n.getMessage("iconTitle") || "Translate selected text",
      );
      icon.title = chrome.i18n.getMessage("iconTitle") || "Translate";
      icon.tabIndex = -1;
      icon.disabled = true;
      icon.addEventListener("click", handleIconClick);
      icon.addEventListener("mousedown", (event) => {
        if (event.button === 0) {
          event.preventDefault();
        }
      });
      const image = document.createElement("img");
      image.alt = "";
      image.draggable = false;
      image.addEventListener("error", (event) => {
        console.error("Failed to load icon from", ICON_PATH, event);
      });

      image.addEventListener("load", () => revealIcon(icon));
      image.src = ICON_PATH;
      icon.appendChild(image);
      shadowRoot.appendChild(icon);
      document.documentElement.appendChild(host);

      return icon;
    }

    function revealIcon(icon) {
      const image = icon?.querySelector("img");
      if (
        !iconIsVisible ||
        !iconStylesLoaded ||
        currentIcon !== icon ||
        !image?.complete ||
        image.naturalWidth === 0
      ) {
        return;
      }

      requestAnimationFrame(() => {
        if (currentIcon === icon && iconIsVisible) {
          icon.classList.add("translate-icon-visible");
          icon.disabled = false;
          icon.tabIndex = 0;
        }
      });
    }
    function handleIconClick(event) {
      event.stopPropagation();
      event.preventDefault();

      if (currentSelection.trim()) {
        chrome.runtime
          .sendMessage({
            action: "translateSelection",
            text: currentSelection,
            anchor: getPopupAnchor(event),
          })
          .catch((error) => {
            console.error("Failed to request translation:", error);
          });
      }

      hideIcon();

      // Suppress icon for a short time after click to prevent immediate reappearance
      suppressIcon = true;
      if (suppressTimer) {
        clearTimeout(suppressTimer);
      }
      suppressTimer = setTimeout(() => {
        suppressIcon = false;
        suppressTimer = null;
      }, 500);
    }
    function scheduleSelectionUpdate() {
      if (selectionFrame !== null) {
        return;
      }

      selectionFrame = requestAnimationFrame(() => {
        selectionFrame = null;
        updateIconFromSelection();
      });
    }

    function updateIconFromSelection() {
      if (!settingsLoaded || suppressIcon || !settings.show_icon) {
        hideIcon();
        return;
      }

      const selectedText = getSelectedText();
      if (!selectedText) {
        hideIcon();
        return;
      }

      currentSelection = selectedText;
      currentWordRect = getLastWordRect();

      if (settings.icon_position === "cursor" && !keyboardSelection) {
        showIcon(mouseX, mouseY);
        return;
      }

      const selectionRect = currentWordRect;
      if (selectionRect) {
        showIcon(selectionRect.right, selectionRect.bottom);
      } else {
        showIcon(mouseX, mouseY);
      }
    }
    function showIcon(x, y) {
      if (!currentIcon || !iconHost?.isConnected) {
        currentIcon = createIcon();
        iconStylesLoaded = false;
        iconIsVisible = false;
      }
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let viewportX = x + ICON_MARGIN;
      let viewportY = y - ICON_SIZE - ICON_MARGIN;
      if (viewportX + ICON_SIZE > viewportWidth) {
        viewportX = x - ICON_SIZE - ICON_MARGIN;
      }
      if (viewportY < 0) {
        viewportY = y + ICON_MARGIN;
      }
      viewportX = Math.min(
        Math.max(ICON_MARGIN, viewportX),
        Math.max(ICON_MARGIN, viewportWidth - ICON_SIZE - ICON_MARGIN),
      );
      viewportY = Math.min(
        Math.max(ICON_MARGIN, viewportY),
        Math.max(ICON_MARGIN, viewportHeight - ICON_SIZE - ICON_MARGIN),
      );

      currentIcon.style.left = `${viewportX}px`;
      currentIcon.style.top = `${viewportY}px`;

      if (!iconIsVisible) {
        iconIsVisible = true;
        revealIcon(currentIcon);
      }
    }
    function hideIcon() {
      currentSelection = "";
      currentWordRect = null;
      if (currentIcon && iconIsVisible) {
        iconIsVisible = false;
        currentIcon.disabled = true;
        currentIcon.tabIndex = -1;
        currentIcon.classList.remove("translate-icon-visible");
      }
    }
    function loadSettings() {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to load extension settings:",
            chrome.runtime.lastError,
          );
        }
        const loaded = globalThis.normalizeSettings({
          ...(chrome.runtime.lastError ? DEFAULT_SETTINGS : result),
          ...settingsOverrides,
        });
        settings.show_icon = loaded.show_icon;
        settings.icon_position = loaded.icon_position;
        settingsLoaded = true;
        scheduleSelectionUpdate();
      });
    }
    function getSelectedText() {
      return window.getSelection()?.toString().trim() || "";
    }
    function getLastWordRect() {
      const selection = window.getSelection();
      if (
        !selection ||
        selection.rangeCount === 0 ||
        !selection.toString().trim()
      ) {
        return null;
      }
      const range = selection.getRangeAt(0);
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
      );
      walker.currentNode = range.endContainer;
      let node;
      if (range.endContainer.nodeType === Node.TEXT_NODE) {
        node = range.endOffset > 0 ? range.endContainer : walker.previousNode();
      } else if (range.endOffset < range.endContainer.childNodes.length) {
        walker.currentNode = range.endContainer.childNodes[range.endOffset];
        node = walker.previousNode();
      } else {
        node = walker.lastChild() || walker.previousNode();
      }
      let fallbackRect = null;
      while (node && range.intersectsNode(node)) {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.length;
        const text = node.data.slice(start, end);
        let word;
        for (const segment of wordSegmenter.segment(text)) {
          if (segment.isWordLike || /[\p{L}\p{N}]/u.test(segment.segment)) {
            word = segment;
          }
        }
        const fallback = /\S+\s*$/u.exec(text);
        if (word || (!fallbackRect && fallback)) {
          const wordRange = range.cloneRange();
          const offset = word ? word.index : fallback.index;
          const length = word
            ? word.segment.length
            : fallback[0].trimEnd().length;
          wordRange.setStart(node, start + offset);
          wordRange.setEnd(node, start + offset + length);
          const rect = wordRange.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            if (word) {
              return rect;
            }
            fallbackRect = rect;
          }
        }
        node = walker.previousNode();
      }
      return fallbackRect;
    }

    function getPopupAnchor(event) {
      const hasPointer =
        Number.isFinite(event?.screenX) &&
        Number.isFinite(event?.screenY) &&
        (event.screenX !== 0 || event.screenY !== 0);
      const rect = getLastWordRect() || currentWordRect;
      const innerX = window.mozInnerScreenX;
      const innerY = window.mozInnerScreenY;
      const hasOrigin = Number.isFinite(innerX) && Number.isFinite(innerY);
      if (hasPointer && hasOrigin) {
        const scale =
          event.clientX > 10
            ? (event.screenX - innerX) / event.clientX
            : event.clientY > 10
              ? (event.screenY - innerY) / event.clientY
              : lastScreenScale;
        if (scale >= 0.25 && scale <= 5) {
          lastScreenScale = scale;
        }
      }
      const originX = hasOrigin
        ? innerX
        : hasPointer
          ? event.screenX - event.clientX
          : window.screenX;
      const originY = hasOrigin
        ? innerY
        : hasPointer
          ? event.screenY - event.clientY
          : window.screenY + window.outerHeight - window.innerHeight;
      const selection = rect
        ? {
            left: originX + rect.left * lastScreenScale,
            top: originY + rect.top * lastScreenScale,
            right: originX + rect.right * lastScreenScale,
            bottom: originY + rect.bottom * lastScreenScale,
          }
        : undefined;
      return {
        scaleWithTabZoom: hasOrigin,
        x: hasPointer ? event.screenX : (selection?.right ?? originX),
        y: hasPointer ? event.screenY : (selection?.bottom ?? originY),
        selection,
        screen: {
          left: window.screen.availLeft ?? 0,
          top: window.screen.availTop ?? 0,
          width: window.screen.availWidth,
          height: window.screen.availHeight,
        },
      };
    }
    function handleMouseUp(event) {
      if (event.button === 0) {
        keyboardSelection = false;
        rememberSelection();
        mouseX = event.clientX;
        mouseY = event.clientY;
        scheduleSelectionUpdate();
      }
    }

    function rememberSelection() {
      const selection = window.getSelection();
      const state = selection
        ? [
            selection.toString(),
            selection.anchorNode,
            selection.anchorOffset,
            selection.focusNode,
            selection.focusOffset,
          ]
        : [];
      const changed =
        !lastSelectionState ||
        state.length !== lastSelectionState.length ||
        state.some((value, index) => value !== lastSelectionState[index]);
      lastSelectionState = state;
      return changed;
    }

    function handleKeyUp() {
      if (!rememberSelection()) {
        return;
      }
      keyboardSelection = true;
      scheduleSelectionUpdate();
    }

    function handleMouseDown(event) {
      if (
        event.button === 0 &&
        iconIsVisible &&
        !iconHost?.contains(event.target)
      ) {
        hideIcon();
      }
    }
    function handleClickOutside(event) {
      if (
        currentIcon &&
        !iconHost?.contains(event.target) &&
        !getSelectedText()
      ) {
        hideIcon();
      }
    }
    function handleScroll() {
      if (currentIcon) {
        hideIcon();
      }
    }
    function init() {
      rememberSelection();
      loadSettings();
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "sync") {
          if (changes.show_icon) {
            settings.show_icon = globalThis.normalizeSettings({
              show_icon: changes.show_icon.newValue,
            }).show_icon;
            settingsOverrides.show_icon = settings.show_icon;
            if (!settings.show_icon) {
              hideIcon();
            } else {
              scheduleSelectionUpdate();
            }
          }
          if (changes.icon_position) {
            settings.icon_position = globalThis.normalizeSettings({
              icon_position: changes.icon_position.newValue,
            }).icon_position;
            settingsOverrides.icon_position = settings.icon_position;
            if (iconIsVisible) {
              scheduleSelectionUpdate();
            }
          }
        }
      });
      document.addEventListener(
        "contextmenu",
        (event) => {
          contextMenuAnchor = {
            anchor: getPopupAnchor(event),
            time: Date.now(),
          };
        },
        true,
      );
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.action !== "getTranslationAnchor") {
          return false;
        }
        sendResponse({
          anchor:
            contextMenuAnchor && Date.now() - contextMenuAnchor.time < 60000
              ? contextMenuAnchor.anchor
              : null,
        });
        return false;
      });
      document.addEventListener("mouseup", handleMouseUp, true);
      document.addEventListener("mousedown", handleMouseDown, true);
      document.addEventListener("keyup", handleKeyUp, true);
      document.addEventListener("click", handleClickOutside, true);
      document.addEventListener("scroll", handleScroll, true);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  } catch (error) {
    console.error("Content script error:", error);
  }
})();
