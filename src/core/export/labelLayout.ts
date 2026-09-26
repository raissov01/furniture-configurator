export type LabelPage = 'a4' | 'a5'
export type LabelSize = { page: LabelPage; widthMm: number; heightMm: number }

const MM_TO_PT = 72 / 25.4
const PAGE_MM: Record<LabelPage, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
}

/** True physical dimensions; 5 mm printer margin and 2 mm cutting gap. */
export function labelLayout(size: LabelSize): {
  pageWidthPt: number; pageHeightPt: number
  labelWidthPt: number; labelHeightPt: number
  marginPt: number; gapPt: number
  columns: number; rows: number; perPage: number
} {
  if (!Number.isInteger(size.widthMm) || !Number.isInteger(size.heightMm) ||
      size.widthMm < 58 || size.heightMm < 40) {
    throw new Error('label size: minimum 58 × 40 mm')
  }
  const page = PAGE_MM[size.page]
  if (!page) throw new Error('label page: unsupported page')
  const margin = 5
  const gap = 2
  const columns = Math.floor((page.width - 2 * margin + gap) / (size.widthMm + gap))
  const rows = Math.floor((page.height - 2 * margin + gap) / (size.heightMm + gap))
  if (columns < 1 || rows < 1) throw new Error('label size exceeds the print page / размер бирки больше листа')
  return {
    pageWidthPt: page.width * MM_TO_PT,
    pageHeightPt: page.height * MM_TO_PT,
    labelWidthPt: size.widthMm * MM_TO_PT,
    labelHeightPt: size.heightMm * MM_TO_PT,
    marginPt: margin * MM_TO_PT,
    gapPt: gap * MM_TO_PT,
    columns, rows, perPage: columns * rows,
  }
}
