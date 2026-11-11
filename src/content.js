// Content script for Yandex Translate extension
// Shows translation icon when text is selected

(function () {
  "use strict";

  try {
    // Configuration
    const ICON_SIZE = 32;
    const ICON_MARGIN = 5;
    const ICON_PATH = chrome.runtime.getURL("assets/icons/icon-48.png");

    const DEFAULT_SETTINGS = globalThis.DEFAULT_SETTINGS;

    const ICON_STYLES_PATH = chrome.runtime.getURL("src/content.css");

    // State
    let currentIcon = null;
    let iconHost = null;
    let iconStylesLoaded = false;
    let iconIsVisible = false;
    let currentSelection = "";
    let mouseX = 0;
    let mouseY = 0;
    let showIconTimer = null;
    let suppressIcon = false;
    let suppressTimer = null;
    const settings = {
      show_icon: DEFAULT_SETTINGS.show_icon,
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
        chrome.runtime.sendMessage({
          action: "translateSelection",
          text: currentSelection,
          x: mouseX,
          y: mouseY,
        });
      }

      hideIcon();

      // Suppress icon for a short time after click to prevent immediate reappearance
      suppressIcon = true;
      if (suppressTimer) clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => {
        suppressIcon = false;
        suppressTimer = null;
      }, 500); // 500ms suppression
    }

    // Schedule showing icon with a delay
    function scheduleShowIcon() {
      // Skip if icon is suppressed (e.g., after click)
      if (suppressIcon) {
        return;
      }

      // Skip if icon is disabled in settings
      if (!settings.show_icon) {
        return;
      }

      // Clear any existing timer
      if (showIconTimer) {
        clearTimeout(showIconTimer);
        showIconTimer = null;
      }

      // Set new timer
      showIconTimer = setTimeout(() => {
        const selectedText = getSelectedText();
        if (!selectedText) {
          // Selection disappeared, don't show icon
          return;
        }
        currentSelection = selectedText;

        const selRect = getSelectionRect();
        if (selRect) {
          showIcon(selRect.right, selRect.top);
        } else {
          // Fallback to last mouse coordinates
          showIcon(mouseX, mouseY);
        }
        showIconTimer = null;
      }, 150); // 150ms delay
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
      if (showIconTimer) {
        clearTimeout(showIconTimer);
        showIconTimer = null;
      }
    }

    // Load settings from storage
    function loadSettings() {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
        settings.show_icon = result.show_icon;
      });
    }

    // Get selected text
    function getSelectedText() {
      return window.getSelection().toString().trim();
    }

    // Get bounding rectangle of selection
    function getSelectionRect() {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      return range.getBoundingClientRect();
    }

    // Handle mouse up (selection end)
    function handleMouseUp(event) {
      // Small delay to allow selection to update
      setTimeout(() => {
        const selectedText = getSelectedText();

        if (selectedText && selectedText.length > 0) {
          // Skip if icon is suppressed (e.g., after click)
          if (suppressIcon) {
            return;
          }

          // Skip if icon is disabled in settings
          if (!settings.show_icon) {
            return;
          }

          currentSelection = selectedText;

          // Try to get selection rectangle for better positioning
          const selRect = getSelectionRect();
          if (selRect) {
            mouseX = selRect.right;
            mouseY = selRect.top;
          } else {
            mouseX = event.clientX;
            mouseY = event.clientY;
          }

          scheduleShowIcon();
        } else {
          hideIcon();
        }
      }, 10);
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
            settings.show_icon = changes.show_icon.newValue;
          }
        }
      });

      // Listen for selection events
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("scroll", handleScroll);

      // Also listen for selectionchange for better responsiveness
      document.addEventListener("selectionchange", () => {
        const selectedText = getSelectedText();
        if (selectedText && selectedText.length > 0) {
          // Skip if icon is suppressed (e.g., after click)
          if (suppressIcon) {
            return;
          }
          // Skip if icon is disabled in settings
          if (!settings.show_icon) {
            return;
          }
          currentSelection = selectedText;
          const selRect = getSelectionRect();
          if (selRect) {
            mouseX = selRect.right;
            mouseY = selRect.top;
            scheduleShowIcon();
          }
        } else {
          hideIcon();
        }
      });
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
