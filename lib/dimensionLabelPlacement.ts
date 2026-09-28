type Position = [number, number, number]

/** UI anchor positions in cabinet space, mm. No panel or cut dimensions change. */
export function dimensionLabelPositions(height: number, width: number, depth: number): {
  height: Position
  width: Position
  depth: Position
} {
  const insetX = Math.min(70, Math.floor(width / 4))
  const topInset = Math.min(120, Math.floor(height / 4))
  return {
    height: [insetX, Math.floor(height / 2), 0],
    width: [Math.floor(width / 2), height - topInset, 0],
    depth: [width - insetX, Math.floor(height / 3), Math.floor(depth / 2)],
  }
}
