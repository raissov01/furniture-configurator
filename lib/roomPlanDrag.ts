/** Pointer distance uses the actual CSS-rendered scale, including on narrow screens. */
export function planDragOffset(startOffset: number, alongPx: number, pxPerMm: number, max: number): number {
  return Math.round(Math.min(max, Math.max(0, startOffset + alongPx / pxPerMm)))
}
