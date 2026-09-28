type Anchor = { left: number; right: number; top: number; bottom: number }

/** Fixed menus use viewport coordinates, so scroll containers cannot clip them. */
export function menuPosition(anchor: Anchor, viewportWidth: number, viewportHeight: number,
  menuWidth: number, align: 'left' | 'right' = 'right', heightCap = 480) {
  const margin = 12
  // PRO100 мәзірлері ұзын (Вид — 30-ға жуық пункт): классикалық мәзір жолағы үлкен шек береді.
  const maxHeight = Math.min(heightCap, viewportHeight - margin * 2)
  const wantedLeft = align === 'right' ? anchor.right - menuWidth : anchor.left
  const left = Math.max(margin, Math.min(wantedLeft, viewportWidth - menuWidth - margin))
  const below = viewportHeight - anchor.bottom - margin
  const top = below >= Math.min(maxHeight, 240) || anchor.top < below
    ? anchor.bottom
    : Math.max(margin, anchor.top - maxHeight - margin)
  return { left, top, maxHeight }


}
