export function tourCardPosition(
  target: { top: number; bottom: number; left: number },
  viewportWidth: number, viewportHeight: number, cardHeight: number, cardWidth: number,
): { top: number; left: number } {
  const margin = 12
  const height = Math.min(cardHeight, Math.max(0, viewportHeight - 2 * margin))
  const width = Math.min(cardWidth, Math.max(0, viewportWidth - 2 * margin))
  const below = target.bottom + margin + height <= viewportHeight - margin
  const proposedTop = below ? target.bottom + margin : target.top - height - margin
  return {
    top: Math.max(margin, Math.min(proposedTop, viewportHeight - height - margin)),
    left: Math.max(margin, Math.min(target.left, viewportWidth - width - margin)),
  }
}
