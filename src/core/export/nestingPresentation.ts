/** Картаға жеке бос қорытынды бет қоспау. */
export const sheetPageCount = (sheetCount: number): number => Math.max(1, sheetCount)

export function partCaption(
  label: string, widthMm: number, heightMm: number, boxWidth: number, boxHeight: number,
  number: number, textWidth: (text: string, size: number) => number,
): { lines: string[]; size: number } {
  const lines = [label, `${widthMm} × ${heightMm}`]
  const size = 8
  if (boxHeight >= 20 && lines.every((line) => textWidth(line, size) <= boxWidth - 6)) {
    return { lines, size }
  }
  return { lines: [String(number)], size }
}
