import type { LabelPage, LabelSize } from '@/src/core/export/labelLayout'
import { labelLayout } from '@/src/core/export/labelLayout'
import type { GroupNode } from '@/src/core/tree'

/** Алғашқы деталь нұсқасы — 1; монтаждағы ауыстыру биркалары 2-ден басталады. */
export function projectLabelIdentity(root: GroupNode): { projectId: string; version: number } {
  const first = root.children[0]
  return { projectId: first?.id ?? root.id, version: 1 }
}

export function labelSizeLimits(page: LabelPage): { width: number; height: number } {
  // labelLayout: парақ жиегінің екі жағында 5 мм басылмайтын аймақ бар.
  return page === 'a5' ? { width: 138, height: 200 } : { width: 200, height: 287 }
}

/** Жеке PDF пен цех ZIP бірдей физикалық өлшем және QR дерегін алады. */
export function labelExportOptions(size: LabelSize, projectId: string, version: number): {
  size: LabelSize; projectId: string; version: number
} {
  const limits = labelSizeLimits(size.page)
  if (!Number.isInteger(size.widthMm) || size.widthMm < 58 || size.widthMm > limits.width) {
    throw new Error(`Жапсырма ені: 58–${limits.width} мм рұқсат`)
  }
  if (!Number.isInteger(size.heightMm) || size.heightMm < 40 || size.heightMm > limits.height) {
    throw new Error(`Жапсырма биіктігі: 40–${limits.height} мм рұқсат`)
  }
  if (!projectId || !Number.isSafeInteger(version) || version < 1) throw new Error('QR: жоба ID мен нұсқасы қажет')
  labelLayout(size)
  return { size, projectId, version }
}
