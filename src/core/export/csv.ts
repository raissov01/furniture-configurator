/**
 * CSV экспорты (PHASE-2 A5) — цехтың өз раскрой бағдарламасына беру үшін.
 * Тек РЕЗ өлшемі: оптимизаторға готовый өлшемнің қажеті жоқ әрі қауіпті.
 */

import type { Catalog, Panel } from '../types'
import { formatCutList } from '../cutList'

const HEADER = ['length', 'width', 'qty', 'material', 'edgeL1', 'edgeL2', 'edgeW1', 'edgeW2', 'grain'] as const

function escape(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function cutListToCsv(panels: Panel[], catalog: Catalog): string {
  const rows = formatCutList(panels, catalog)
  const lines = [HEADER.join(',')]
  for (const r of rows) {
    lines.push([
      r.cutLength, r.cutWidth, r.qty, r.material,
      r.edgeL1, r.edgeL2, r.edgeW1, r.edgeW2,
      r.grain === 'нет' ? 'none' : 'along-length',
    ].map(escape).join(','))
  }
  return lines.join('\n') + '\n'
}

/** Присадка: әр тесік жеке жол. Станокқа тікелей беруге келеді. */
export function drillingToCsv(panels: Panel[]): string {
  const lines = ['panel,label,face,x,y,diameter,depth,purpose']
  for (const p of panels) {
    for (const d of p.drilling) {
      lines.push([p.id, p.label, d.face, d.x, d.y, d.diameter, d.depth, d.purpose].map(escape).join(','))
    }
  }
  return lines.join('\n') + '\n'
}
