/** PRO100 атауларынан тек дәл сәйкестігі бар тікбұрышты корпус қатарын алады. */
import type { CabinetTemplate } from './templates'
export type NomenclatureRow = {
  raw: string
  category: string
  kind: 'base' | 'wall' | 'tall' | 'other'
  doors: number
  drawers: number
  width: number | null
  special: string | null
  count: number
}

export type NomenclatureMatch = {
  id: string
  baseId: string
  width: number
  frontCount: number | null
  drawerCount: number | null
  sourceCount: number
  sourceNames: string[]
}

export type NomenclatureUnmatched = NomenclatureRow & {
  reason: 'unknown-width' | 'width-out-of-range' | 'unsupported-type' | 'inconsistent-width'
}

/** `unrar lb` тізімі ғана: файл мазмұны, текстура, материал оқылмайды. */
export function rowsFromArchivePaths(paths: readonly string[]): NomenclatureRow[] {
  const rows: NomenclatureRow[] = []
  for (const originalPath of paths) {
    const path = originalPath.replaceAll('\\', '/')
    const parts = path.split('/')
    const furnitureAt = parts.indexOf('Мебель')
    const filename = parts.at(-1) ?? ''
    if (furnitureAt < 1 || parts[furnitureAt - 1] !== 'Библиотека' || !/\.meb$/iu.test(filename)) continue
    const raw = filename.replace(/\.meb$/iu, '')
    const isKitchen = /^0[1-3] Кухни/iu.test(parts[furnitureAt + 1] ?? '')
    const kind = !isKitchen ? 'other' : /^В(?:\s|-|\d)/iu.test(raw) ? 'wall'
      : /^Н(?:\s|-|\d)/iu.test(raw) ? 'base' : 'other'
    const widths = [...raw.matchAll(/(?<!\d)\d{3,4}(?!\d)/gu)].map((match) => Number(match[0]))
    const door = /(?:^|\s)([12])дв(?:\s|$)/iu.exec(raw)
    const drawers = /^Н\s+В([234])\s*\(?\d{3,4}\)?$/iu.exec(raw)
    rows.push({ raw, category: parts.at(-2) ?? '', kind, doors: door ? Number(door[1]) : 0,
      drawers: drawers ? Number(drawers[1]) : 0,
      width: widths.length === 1 ? widths[0]! : null,
      special: /(?:^|[^\p{L}])мойка(?:$|[^\p{L}])/iu.test(raw) ? 'мойка (раковина)' : null, count: 1 })
  }
  return rows
}

type Shape = Pick<NomenclatureMatch, 'baseId' | 'frontCount' | 'drawerCount'> & { key: string; min: number; max: number; parsedWidth: number }

function shape(row: NomenclatureRow): Shape | null {
  const name = row.raw.trim()
  if (row.kind === 'wall' && row.special === null && row.drawers === 0) {
    const doors = /^В\s*(?:-\s*)?(?:([12])дв\s+(\d{3})|(\d{3})\s+([12])дв)$/iu.exec(name)
    if (doors) {
      const count = Number(doors[1] ?? doors[4])
      if (row.doors === count) return { key: `wall-${count}`, baseId: 'kitchen-wall-600', frontCount: count, drawerCount: null, min: 300, max: 900, parsedWidth: Number(doors[2] ?? doors[3]) }
    }
  }
  if (row.kind === 'base' && row.special === null && row.doors === 0) {
    const drawers = /^Н\s+В([234])\s*\(?(\d{3,4})\)?$/iu.exec(name)
    if (drawers && row.drawers === Number(drawers[1])) {
      const count = row.drawers
      return { key: `base-drawers-${count}`, baseId: count === 3 ? 'kitchen-base-drawers-600' : `kitchen-base-drawers-${count}-600`, frontCount: 0, drawerCount: count, min: count === 2 ? 400 : 300, max: 900, parsedWidth: Number(drawers[2]) }
    }
  }
  const sink = /^Н\s+2дв\s+Мойка\s+(\d{3})\.?$/iu.exec(name)
  if (row.kind === 'base' && row.special === 'мойка (раковина)' && row.doors === 2 && row.drawers === 0 && sink) {
    return { key: 'sink-2', baseId: 'kitchen-sink-800', frontCount: 2, drawerCount: null, min: 500, max: 1000, parsedWidth: Number(sink[1]) }
  }
  return null
}

/** Дәл емес қатар есепке кетеді; қайталанатын атаулар бір шаблон еніне жиналады. */
export function importNomenclature(rows: readonly NomenclatureRow[]): {
  matched: NomenclatureMatch[]; unmatched: NomenclatureUnmatched[]
} {
  const matches = new Map<string, NomenclatureMatch>()
  const unmatched: NomenclatureUnmatched[] = []
  for (const row of rows) {
    const candidate = shape(row)
    const reason = row.width === null ? 'unknown-width' : !candidate ? 'unsupported-type'
      : row.width !== candidate.parsedWidth ? 'inconsistent-width'
      : row.width < candidate.min || row.width > candidate.max ? 'width-out-of-range' : null
    if (reason) { unmatched.push({ ...row, reason }); continue }
    const width = row.width!
    const id = `standard-${candidate!.key}-${width}`
    const previous = matches.get(id)
    if (previous) {
      previous.sourceCount += row.count
      if (!previous.sourceNames.includes(row.raw)) previous.sourceNames.push(row.raw)
    } else {
      matches.set(id, { id, baseId: candidate!.baseId, width,
        frontCount: candidate!.frontCount, drawerCount: candidate!.drawerCount,
        sourceCount: row.count, sourceNames: [row.raw] })
    }
  }
  return { matched: [...matches.values()].sort((a, b) => a.id.localeCompare(b.id)), unmatched }
}

/** H/D қолдағы үлгіден алынады; PRO100 атауы тек W мен типті дәлелдейді. */
export function makeNomenclatureTemplates(
  bases: readonly CabinetTemplate[], manifest: readonly NomenclatureMatch[],
): CabinetTemplate[] {
  return manifest.map((entry) => {
    const base = bases.find((template) => template.id === entry.baseId)
    if (!base) throw new Error(`Номенклатураның базалық шаблоны табылмады: ${entry.baseId}`)
    if (entry.width < base.range.width.min || entry.width > base.range.width.max) {
      throw new Error(`Номенклатура ені шаблон аралығынан тыс: ${entry.id}`)
    }
    return {
      ...base, id: entry.id, width: entry.width, name: entry.sourceNames[0] ?? base.name,
      subcategory: 'Стандарт номенклатура',
      description: 'Размерная серия PRO100; высота и глубина взяты из базового шаблона.',
      recommendedWidths: [entry.width],
      sourceNames: [...entry.sourceNames],
      sections: base.sections.map((section) => ({
        ...section,
        fronts: entry.frontCount === null ? section.fronts : entry.frontCount === 0 ? null
          : { count: entry.frontCount, mount: 'overlay' as const },
        contents: section.contents.map((content) => content.kind === 'drawers' && entry.drawerCount !== null
          ? { ...content, count: entry.drawerCount } : { ...content }),
      })),
    }
  })
}
