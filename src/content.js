// Content script for Yandex Translate extension
// Shows translation icon when text is selected

(function () {
  "use strict";

  try {
    // Configuration
    const ICON_SIZE = 32;
    const ICON_MARGIN = 5;
    const ICON_PATH = chrome.runtime.getURL("assets/icons/icon-48.png");
    const ICON_STYLES_PATH = chrome.runtime.getURL("src/content.css");
    const DEFAULT_SETTINGS = globalThis.DEFAULT_SETTINGS;

    // State
    let currentIcon = null;
    let iconHost = null;
    let iconStylesLoaded = false;
    let iconIsVisible = false;
    let currentSelection = "";
    let mouseX = 0;
    let mouseY = 0;
    let keyboardSelection = false;
    let contextMenuAnchor = null;
    let lastScreenScale = 1;
    let selectionFrame = null;
    let suppressIcon = false;
    let suppressTimer = null;
    let settingsLoaded = false;
    const settingsOverrides = {};
    const settings = {
      show_icon: DEFAULT_SETTINGS.show_icon,
      icon_position: DEFAULT_SETTINGS.icon_position,
    };

    // Create icon element
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

      // Log image loading errors
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

    // Handle icon click
    function handleIconClick(event) {
      event.stopPropagation();
      event.preventDefault();

      if (currentSelection.trim()) {
        // Send message to background script to open translation
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
      }, 500); // 500ms suppression
    }

    // Coalesce mouse and keyboard events into one update on the next frame.
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

      if (settings.icon_position === "cursor" && !keyboardSelection) {
        showIcon(mouseX, mouseY);
        return;
      }

      const selectionRect = getSelectionRect();
      if (selectionRect) {
        showIcon(selectionRect.right, selectionRect.top);
      } else {
        showIcon(mouseX, mouseY);
      }
    }

    // Show icon at position
    function showIcon(x, y) {
      if (!currentIcon || !iconHost?.isConnected) {
        currentIcon = createIcon();
        iconStylesLoaded = false;
        iconIsVisible = false;
      }

      // Position icon near mouse or selection
      const viewportWidth = window.innerWidth;

      // Coordinates relative to viewport
      let viewportX = x + ICON_MARGIN;
      let viewportY = y - ICON_SIZE - ICON_MARGIN;

      // Adjust if icon goes out of viewport
      if (viewportX + ICON_SIZE > viewportWidth) {
        viewportX = x - ICON_SIZE - ICON_MARGIN;
      }
      if (viewportY < 0) {
        viewportY = y + ICON_MARGIN;
      }

      currentIcon.style.left = `${viewportX}px`;
      currentIcon.style.top = `${viewportY}px`;

      if (!iconIsVisible) {
        iconIsVisible = true;
        revealIcon(currentIcon);
      }
    }

    // Hide icon
    function hideIcon() {
      currentSelection = "";
      if (currentIcon && iconIsVisible) {
        iconIsVisible = false;
        currentIcon.disabled = true;
        currentIcon.tabIndex = -1;
        currentIcon.classList.remove("translate-icon-visible");
      }
    }

    // Load settings from storage
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

    // Get selected text
    function getSelectedText() {
      return window.getSelection()?.toString().trim() || "";
    }

    // Get the rectangle covering the selected text.
    function getSelectionRect() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return null;
      }

      return selection.getRangeAt(0).getBoundingClientRect();
    }

    function getPopupAnchor(event) {
      const hasPointer =
        Number.isFinite(event?.screenX) &&
        Number.isFinite(event?.screenY) &&
        (event.screenX !== 0 || event.screenY !== 0);
      const rect = getSelectionRect();
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

    // Handle mouse up (selection end)
    function handleMouseUp(event) {
      if (event.button === 0) {
        keyboardSelection = false;
        mouseX = event.clientX;
        mouseY = event.clientY;
        scheduleSelectionUpdate();
      }
    }

    function handleKeyUp() {
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

    // Handle click outside
    function handleClickOutside(event) {
      if (
        currentIcon &&
        !iconHost?.contains(event.target) &&
        !getSelectedText()
      ) {
        hideIcon();
      }
    }

    // Handle scroll
    function handleScroll() {
      if (currentIcon) {
        hideIcon();
      }
    }

    // Initialize
    function init() {
      // Load settings
      loadSettings();

      // Listen for storage changes to update settings
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

      // Listen for selection events
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

    // Start when DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  } catch (error) {
    console.error("[Yandex Translate] Content script error:", error);
  }
})();
