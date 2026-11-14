const GAP = 12;
const SCREEN_MARGIN = 8;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function screenBounds(anchor) {
  const screen = anchor?.screen;
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

function selectionBounds(anchor) {
  const rect = anchor?.selection;
  return rect &&
    [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite) &&
    rect.right >= rect.left &&
    rect.bottom >= rect.top
    ? rect
    : null;
}

function overlap(left, top, width, height, selection) {
  if (!selection) {
    return 0;
  }
  return (
    Math.max(
      0,
      Math.min(left + width, selection.right) - Math.max(left, selection.left),
    ) *
    Math.max(
      0,
      Math.min(top + height, selection.bottom) - Math.max(top, selection.top),
    )
  );
}

export function translationPosition(anchor, width, height, tabZoom = 1) {
  // Firefox reports content screen coordinates in zoomed CSS pixels, whereas
  // the windows API uses desktop CSS pixels. Chromium coordinates need no conversion.
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
  const bounds = screenBounds(anchor);
  const selection = selectionBounds(anchor);
  if (
    !bounds ||
    !Number.isFinite(anchor?.x) ||
    !Number.isFinite(anchor?.y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return {};
  }
  const x = clamp(anchor.x, bounds.left, bounds.right);
  const y = clamp(anchor.y, bounds.top, bounds.bottom);
  const candidates = [
    { left: Math.max(x, selection?.right ?? x) + GAP, top: y },
    { left: Math.min(x, selection?.left ?? x) - width - GAP, top: y },
    { left: x, top: (selection?.bottom ?? y) + GAP },
    { left: x, top: (selection?.top ?? y) - height - GAP },
  ].map((position) => ({
    left: Math.round(clamp(position.left, bounds.left, bounds.right - width)),
    top: Math.round(clamp(position.top, bounds.top, bounds.bottom - height)),
  }));
  // Prefer a position that keeps the original selection visible. Clamping can
  // make multiple candidates identical when the screen is very small.
  candidates.sort(
    (a, b) =>
      overlap(a.left, a.top, width, height, selection) -
      overlap(b.left, b.top, width, height, selection),
  );
  const best =
    candidates.find(
      (position) =>
        (position.left >= x + GAP ||
          position.left + width <= x - GAP ||
          position.top >= (selection?.bottom ?? y) + GAP ||
          position.top + height <= (selection?.top ?? y) - GAP) &&
        overlap(position.left, position.top, width, height, selection) === 0,
    ) ?? candidates[0];
  return best;
}
