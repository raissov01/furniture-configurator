type Anchor = { left: number; right: number; top: number; bottom: number }

/** Fixed menus use viewport coordinates, so scroll containers cannot clip them. */
export function menuPosition(anchor: Anchor, viewportWidth: number, viewportHeight: number,
  menuWidth: number, align: 'left' | 'right' = 'right') {
  const margin = 12
  const maxHeight = Math.min(480, viewportHeight - margin * 2)
  const wantedLeft = align === 'right' ? anchor.right - menuWidth : anchor.left
  const left = Math.max(margin, Math.min(wantedLeft, viewportWidth - menuWidth - margin))
  const below = viewportHeight - anchor.bottom - margin
  const top = below >= Math.min(maxHeight, 240) || anchor.top < below
    ? anchor.bottom
    : Math.max(margin, anchor.top - maxHeight - margin)
  return { left, top, maxHeight }

}
