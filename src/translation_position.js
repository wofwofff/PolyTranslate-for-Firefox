const GAP = 12;
const SCREEN_MARGIN = 8;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function screenBounds(screen) {
  if (
    !screen ||
    ![screen.left, screen.top, screen.width, screen.height].every(
      Number.isFinite,
    ) ||
    screen.width < 100 ||
    screen.height < 100
  ) {
    return null;
  }
  return {
    left: Math.ceil(screen.left + SCREEN_MARGIN),
    top: Math.ceil(screen.top + SCREEN_MARGIN),
    right: Math.floor(screen.left + screen.width - SCREEN_MARGIN),
    bottom: Math.floor(screen.top + screen.height - SCREEN_MARGIN),
  };
}

function validWindow(window) {
  return (
    window &&
    [window.left, window.top, window.width, window.height].every(
      Number.isFinite,
    ) &&
    window.width > 0 &&
    window.height > 0
  );
}

function validSelection(rect) {
  return (
    rect &&
    [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite) &&
    rect.right > rect.left &&
    rect.bottom > rect.top
  );
}

function fit(left, top, width, height, bounds) {
  return {
    left: Math.round(
      bounds ? clamp(left, bounds.left, bounds.right - width) : left,
    ),
    top: Math.round(
      bounds ? clamp(top, bounds.top, bounds.bottom - height) : top,
    ),
  };
}

export function translationPosition(
  anchor,
  width,
  height,
  { tabZoom = 1, mode = "cursor", sourceWindow } = {},
) {
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return {};
  }
  // Firefox content screen coordinates are zoomed; windows API coordinates are not.
  if (
    anchor?.scaleWithTabZoom &&
    Number.isFinite(tabZoom) &&
    tabZoom > 0 &&
    tabZoom !== 1
  ) {
    const scale = (values) =>
      values &&
      Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value * tabZoom]),
      );
    anchor = {
      ...anchor,
      x: anchor.x * tabZoom,
      y: anchor.y * tabZoom,
      screen: scale(anchor.screen),
      selection: scale(anchor.selection),
    };
  }
  const bounds = screenBounds(anchor?.screen);
  const selection =
    mode === "selection" && validSelection(anchor?.selection)
      ? anchor.selection
      : null;
  const x = selection ? selection.right : anchor?.x;
  const y = selection ? selection.bottom : anchor?.y;

  if (mode === "center" || !bounds || ![x, y].every(Number.isFinite)) {
    if (validWindow(sourceWindow)) {
      return fit(
        sourceWindow.left + (sourceWindow.width - width) / 2,
        sourceWindow.top + (sourceWindow.height - height) / 2,
        width,
        height,
        bounds,
      );
    }
    if (mode === "center" && bounds) {
      return fit(
        (bounds.left + bounds.right - width) / 2,
        (bounds.top + bounds.bottom - height) / 2,
        width,
        height,
        bounds,
      );
    }
    return {};
  }

  let left = x + GAP;
  let top = y + GAP;
  if (left + width > bounds.right && x - GAP - width >= bounds.left) {
    left = x - GAP - width;
  }
  if (top + height > bounds.bottom && y - GAP - height >= bounds.top) {
    top = y - GAP - height;
  }
  return fit(left, top, width, height, bounds);
}
