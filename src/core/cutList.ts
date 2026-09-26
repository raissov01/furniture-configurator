/**
 * Деталировка. Panel[] → CutListRow[].
 *
 * МАҢЫЗДЫ: кестеде ЕКІ өлшем жұбы бар және олар шатаспауы керек —
 *   ГОТОВЫЙ (клиент) — жиналған детальдің өлшемі, кромкасымен бірге
 *   РЕЗ     (цех)    — форматты станок нақты кесетін өлшем
 * Экспортта екеуі бөлек топ болып, кімге арналғаны жазылып тұрады.
 */

import { isWidthBevel } from './types'
import { edgeMetresByBand } from './pricing'
import type { Audience, Catalog, CutListRow, EdgeSpec, Panel } from './types'

/**
 * K9 / audit C9: трапеция детальдің `note` өрісі бос болуы мүмкін (ядро
 * оны толтырмайды), ал цех дәл осы бағанды оқиды. Тікбұрыш деп кесіп
 * алмас үшін, ЕН бойынша қиғашты («бұрыштық» корпус) осында ашық жазамыз.
 * `p.note` бар болса — оны алмастырмаймыз, ядро айтқан нәрсе басым.
 */
const bevelNote = (p: Panel): string => {
  const b = p.bevel
  if (b && isWidthBevel(b)) {
    const straight = b.alignWidth === 'end' ? 'L2' : 'L1'
    return `Трапеция: ${b.widthAtStart}→${b.widthAtEnd}, прямая сторона ${straight}`
  }
  return ''
}

export type ColumnKey =
  | 'name' | 'qty'
  | 'finishedLength' | 'finishedWidth'
  | 'cutLength' | 'cutWidth'
  | 'thickness' | 'material'
  | 'edgeL1' | 'edgeL2' | 'edgeW1' | 'edgeW2'
  | 'grain' | 'note'

export type Column = {
  key: ColumnKey
  header: string
  /** Кімге арналған баған — экспортта топтап көрсету үшін */
  audience: Audience
  /** Кестедегі топтың атауы. Бос жол — топсыз баған. */
  group: string
  align: 'left' | 'right'
}

export const CUT_LIST_COLUMNS: readonly Column[] = [
  { key: 'name', header: 'Наименование', audience: 'both', group: '', align: 'left' },
  { key: 'qty', header: 'Кол-во', audience: 'both', group: '', align: 'right' },
  { key: 'finishedLength', header: 'Длина', audience: 'client', group: 'ГОТОВЫЙ · клиент', align: 'right' },
  { key: 'finishedWidth', header: 'Ширина', audience: 'client', group: 'ГОТОВЫЙ · клиент', align: 'right' },
  { key: 'cutLength', header: 'Длина', audience: 'shop', group: 'РЕЗ · цех', align: 'right' },
  { key: 'cutWidth', header: 'Ширина', audience: 'shop', group: 'РЕЗ · цех', align: 'right' },
  { key: 'thickness', header: 'Толщина', audience: 'both', group: '', align: 'right' },
  { key: 'material', header: 'Материал', audience: 'both', group: '', align: 'left' },
  { key: 'edgeL1', header: 'L1', audience: 'shop', group: 'КРОМКА · цех', align: 'right' },
  { key: 'edgeL2', header: 'L2', audience: 'shop', group: 'КРОМКА · цех', align: 'right' },
  { key: 'edgeW1', header: 'W1', audience: 'shop', group: 'КРОМКА · цех', align: 'right' },
  { key: 'edgeW2', header: 'W2', audience: 'shop', group: 'КРОМКА · цех', align: 'right' },
  { key: 'grain', header: 'Текстура', audience: 'shop', group: '', align: 'left' },
  { key: 'note', header: 'Примечание', audience: 'both', group: '', align: 'left' },
] as const

/** Деталировка жолы + оны құраған панельдер. Позиция нөмірі = индекс + 1. */
export type CutListGroup = { row: CutListRow; panelIds: string[] }

export function formatCutList(panels: Panel[], catalog: Catalog): CutListRow[] {
  return groupPanels(panels, catalog).map((g) => g.row)
}

/** Позиция нөмірлері: сызбадағы белгі мен деталировкадағы жол бір болуы үшін. */
export function partNumbers(panels: Panel[], catalog: Catalog): Map<string, number> {
  const numbers = new Map<string, number>()
  groupPanels(panels, catalog).forEach((group, i) => {
    for (const id of group.panelIds) numbers.set(id, i + 1)
  })
  return numbers
}

export function groupPanels(panels: Panel[], catalog: Catalog): CutListGroup[] {
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))
  const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))

  const bandLabel = (e: EdgeSpec): string => {
    if (!e) return '—'
    const b = bands.get(e.bandId)
    if (!b) throw new Error(`Кромка табылмады: ${e.bandId}`)
    return b.thickness.toFixed(1)
  }

  const groups = new Map<string, CutListGroup>()
  for (const p of panels) {
    const material = materials.get(p.materialId)
    if (!material) throw new Error(`Материал табылмады: ${p.materialId}`)

    const row: CutListRow = {
      name: p.label,
      qty: p.qty,
      finishedLength: p.finishedLength,
      finishedWidth: p.finishedWidth,
      cutLength: p.cutLength,
      cutWidth: p.cutWidth,
      thickness: material.thickness,
      material: material.name,
      edgeL1: bandLabel(p.edges.L1),
      edgeL2: bandLabel(p.edges.L2),
      edgeW1: bandLabel(p.edges.W1),
      edgeW2: bandLabel(p.edges.W2),
      grain: material.hasGrain ? (p.grainAlongLength ? 'вдоль длины' : 'поперёк длины') : 'нет',
      note: [p.note, bevelNote(p), p.contour
        ? `Контур: DXF бойынша; рез — дайындама; кромка: ${p.contour.bands
          .map((spec, i) => spec ? `${i + 1}=${bandLabel(spec)} мм` : '')
          .filter(Boolean).join(', ') || 'жоқ'}` : '']
        .filter(Boolean).join('; '),
    }

    // Бірдей деталь — бір жол. Кілтке орналасу КІРМЕЙДІ: цехқа детальдің
    // қайда тұратыны емес, нешеу кесілетіні керек.
    const key = [
      row.name, row.cutLength, row.cutWidth, row.thickness, row.material,
      row.edgeL1, row.edgeL2, row.edgeW1, row.edgeW2, row.grain, row.note,
      JSON.stringify(p.bevel ?? null),
      JSON.stringify(p.contour ?? null),
    ].join('|')

    const existing = groups.get(key)
    if (existing) {
      existing.row.qty += row.qty
      existing.panelIds.push(p.id)
    } else {
      groups.set(key, { row, panelIds: [p.id] })
    }
  }

  return [...groups.values()]
}

/** Барлық кромканың жалпы ұзындығы, лента бойынша — метрмен (§6 үшін). */
export function edgeBandTotals(panels: Panel[]): Map<string, number> {
  // CLI деталировкасы мен смета бір физикалық жиекті өлшеуі керек:
  // трапецияның алдыңғы кромкасы finishedLength емес, диагональ.
  return edgeMetresByBand(panels)
}
