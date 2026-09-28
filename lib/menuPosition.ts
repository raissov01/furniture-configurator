export type MenuAnchor = { left: number; right: number; top: number; bottom: number }

/** Place a popup in the viewport, away from scroll and overflow clipping. */
export function menuPosition(anchor: MenuAnchor, viewportWidth: number, viewportHeight: number,
  menuWidth: number, menuHeight: number, align: 'left' | 'right') {
  const margin = 8
  const gap = 4
  const width = Math.min(menuWidth, viewportWidth - 2 * margin)
  const preferredLeft = align === 'right' ? anchor.right - width : anchor.left
  const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - width - margin))
  const below = viewportHeight - anchor.bottom - gap - margin
  const above = anchor.top - gap - margin
  if (below < menuHeight && above > below) {
    return { left, top: Math.max(margin, anchor.top - gap - Math.min(menuHeight, above)), maxHeight: above }
  }
  return { left, top: anchor.bottom + gap, maxHeight: below }
}
