/**
 * `input/lite` — 2026-09-26 ашық каталог зерттеуінің қосымша фактілері.
 * Бұл модуль өндірістік `OWN_CATALOG`-ты алмастырмайды: өлшемі белгісіз
 * декор өндірістік Material болып жарияланбайды. Нақты декор коды арқылы
 * ескі Базис id-лерін бар өз каталогымызға байланыстырады.
 */
import { z } from 'zod'
import type { Material } from '../../types'
import { BASIS_MATERIALS } from '../basisCatalog'
import type { OwnMaterialMeta } from './schema'
import { decorKey } from './decorKey'
import { STANDARD_PRODUCT_LINE } from './referencePrices'
import aliasesData from './generated/legacyMaterialAliases.json'

const size = z.tuple([z.number(), z.number()])
const boardSchema = z.object({
  manufacturer: z.string(), decorCode: z.string(), name: z.string(),
  type: z.enum(['ldsp', 'mdf', 'hdf']), finish: z.union([z.string(), z.array(z.string()), z.null()]),
  productLine: z.string().nullable().optional(),
  thicknesses: z.array(z.number()), sheetSizes: z.array(size),
  sourceUrl: z.string(), retrievedAt: z.string(),
  matchedBasisIds: z.array(z.string()),
})
const edgeSchema = z.object({
  manufacturer: z.string(), decorCode: z.string(), name: z.string().nullable(),
  edgeThickness: z.number().nullable(), edgeWidth: z.number().nullable(),
  matchingBoardDecorCodes: z.array(z.string()), matchingBoardManufacturer: z.string().nullable(),
  sourceUrl: z.string(), retrievedAt: z.string(),
})

export type SupplementalBoard = z.infer<typeof boardSchema>
export type SupplementalEdge = z.infer<typeof edgeSchema>
export type SupplementalIssue = { path: string; message: string }

export function parseSupplementalCatalog(boards: unknown, edges: unknown): {
  boards: SupplementalBoard[]; edges: SupplementalEdge[]
} {
  return { boards: z.array(boardSchema).parse(boards), edges: z.array(edgeSchema).parse(edges) }
}

const code = (s: string) => s.replace(/[\s\-_.]/g, '').toUpperCase()
const structure = (finish: SupplementalBoard['finish']): string | null =>
  typeof finish === 'string' ? finish : Array.isArray(finish) && finish.length === 1 ? finish[0]! : null
const date = /^\d{4}-\d{2}-\d{2}$/
const url = /^https?:\/\/\S+$/
const validSheetSide = (n: number) => Number.isInteger(n) && n >= 1000 && n <= 5700

export function validateSupplementalCatalog(boards: SupplementalBoard[], edges: SupplementalEdge[]): SupplementalIssue[] {
  const issues: SupplementalIssue[] = []
  const add = (path: string, message: string) => issues.push({ path, message })
  const seenBoards = new Set<string>()
  const boardKeys = new Set<string>()
  boards.forEach((b, i) => {
    const p = `materials[${i}]`
    if (!b.manufacturer.trim()) add(`${p}.manufacturer`, 'өндіруші міндетті')
    if (!b.decorCode.trim()) add(`${p}.decorCode`, 'декор коды міндетті')
    if (!b.name.trim()) add(`${p}.name`, 'атау міндетті')
    if (!url.test(b.sourceUrl)) add(`${p}.sourceUrl`, 'http(s) URL керек')
    if (!date.test(b.retrievedAt)) add(`${p}.retrievedAt`, 'YYYY-MM-DD керек')
    const key = `${b.type}|${decorKey(b.manufacturer, b.decorCode, structure(b.finish))}|${code(b.productLine ?? '')}`
    if (seenBoards.has(key)) add(`${p}.decorCode`, 'қайталанған декор/құрылым/өнім желісі')
    seenBoards.add(key)
    boardKeys.add(decorKey(b.manufacturer, b.decorCode, null))
    b.thicknesses.forEach((n, j) => {
      if (!Number.isInteger(n) || n < 3 || n > 40) add(`${p}.thicknesses[${j}]`, '3–40 мм бүтін сан керек')
      if (b.thicknesses.indexOf(n) !== j) add(`${p}.thicknesses[${j}]`, 'қайталанған қалыңдық')
    })
    b.sheetSizes.forEach(([a, c], j) => {
      if (!validSheetSide(a)) add(`${p}.sheetSizes[${j}][0]`, '1000–5700 мм бүтін сан керек')
      if (!validSheetSide(c)) add(`${p}.sheetSizes[${j}][1]`, '1000–5700 мм бүтін сан керек')
    })
  })
  const seenEdges = new Set<string>()
  edges.forEach((e, i) => {
    const p = `edges[${i}]`
    if (!e.manufacturer.trim()) add(`${p}.manufacturer`, 'өндіруші міндетті')
    if (!e.decorCode.trim()) add(`${p}.decorCode`, 'кромка коды міндетті')
    if (!url.test(e.sourceUrl)) add(`${p}.sourceUrl`, 'http(s) URL керек')
    if (!date.test(e.retrievedAt)) add(`${p}.retrievedAt`, 'YYYY-MM-DD керек')
    const key = `${e.manufacturer.toLowerCase()}|${code(e.decorCode)}|${e.edgeThickness ?? ''}|${e.edgeWidth ?? ''}`
    if (seenEdges.has(key)) add(`${p}.decorCode`, 'қайталанған кромка/өлшем')
    seenEdges.add(key)
    if (e.edgeThickness !== null && (!(e.edgeThickness > 0) || e.edgeThickness > 3))
      add(`${p}.edgeThickness`, '0–3 мм қалыңдық керек')
    if (e.edgeWidth !== null && (!Number.isInteger(e.edgeWidth) || e.edgeWidth < 10 || e.edgeWidth > 1000))
      add(`${p}.edgeWidth`, '10–1000 мм бүтін ен керек')
    e.matchingBoardDecorCodes.forEach((decor, j) => {
      if (!e.matchingBoardManufacturer || !boardKeys.has(decorKey(e.matchingBoardManufacturer, decor, null)))
        add(`${p}.matchingBoardDecorCodes[${j}]`, 'плита декоры табылмады')
    })
  })
  return issues
}

/** Бір мәнді, геометриясы бірдей сәйкестік қана. Болжау жоқ. */
export function buildLegacyMaterialAliases(
  boards: SupplementalBoard[], basis: Material[], own: Material[], meta: Record<string, OwnMaterialMeta>,
): Record<string, string> {
  const basisById = new Map(basis.map((m) => [m.id, m]))
  const ownCandidates = new Map<string, Material[]>()
  for (const m of own) {
    const x = meta[m.id]
    if (!x) continue
    const k = `${x.kind}|${decorKey(x.manufacturer, x.decorCode, x.structureCode)}`
    ownCandidates.set(k, [...(ownCandidates.get(k) ?? []), m])
  }
  const aliases: Record<string, string> = {}
  const ambiguous = new Set<string>()
  for (const b of boards) {
    const key = `${b.type}|${decorKey(b.manufacturer, b.decorCode, structure(b.finish))}`
    for (const oldId of b.matchedBasisIds) {
      const old = basisById.get(oldId)
      if (!old || ambiguous.has(oldId)) continue
      let candidates = (ownCandidates.get(key) ?? []).filter((m) =>
        m.thickness === old.thickness && m.sheetWidth === old.sheetWidth && m.sheetHeight === old.sheetHeight)
      const line = b.productLine ?? STANDARD_PRODUCT_LINE[b.manufacturer.toLowerCase()]
      if (candidates.length > 1 && line) candidates = candidates.filter((m) => meta[m.id]?.productLine === line)
      const ids = [...new Set(candidates.map((m) => m.id))]
      if (ids.length !== 1 || (aliases[oldId] && aliases[oldId] !== ids[0])) {
        delete aliases[oldId]
        ambiguous.add(oldId)
      } else aliases[oldId] = ids[0]!
    }
  }
  return Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)))
}

export const LEGACY_MATERIAL_ALIASES: Record<string, string> = aliasesData

type ProjectWithMaterials = { materials: Material[] }

/**
 * Сақталған жобаның материал параметрлерін сақтайды; тек анық сәйкестенген
 * Базис ID мен соған сілтемелер жаңартылады. Өзгертілген цех материалы қалады.
 */
export function migrateLegacyProjectMaterials<T extends ProjectWithMaterials>(
  project: T, aliases: Record<string, string> = LEGACY_MATERIAL_ALIASES,
): T {
  const oldById = new Map(BASIS_MATERIALS.map((m) => [m.id, m]))
  const existing = new Set(project.materials.map((m) => m.id))
  const active: Record<string, string> = {}
  for (const m of project.materials) {
    const target = aliases[m.id]
    const original = oldById.get(m.id)
    if (!target || !original || existing.has(target)) continue
    if (m.thickness !== original.thickness || m.sheetWidth !== original.sheetWidth ||
      m.sheetHeight !== original.sheetHeight || m.hasGrain !== original.hasGrain ||
      m.pricePerSheet !== original.pricePerSheet || m.trimEdge !== original.trimEdge) continue
    active[m.id] = target
  }
  if (Object.keys(active).length === 0) return project
  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite)
    if (value === null || typeof value !== 'object') return value
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if ((key === 'materialId' || key.endsWith('MaterialId')) &&
        typeof item === 'string' && active[item]) out[key] = active[item]
      else if (key === 'lineDiscounts' && item !== null && typeof item === 'object' && !Array.isArray(item)) {
        out[key] = Object.fromEntries(Object.entries(item).map(([line, discount]) => {
          const oldId = line.startsWith('materials:') ? line.slice('materials:'.length) : ''
          return [active[oldId] ? `materials:${active[oldId]}` : line, rewrite(discount)]
        }))
      }
      else out[key] = rewrite(item)
    }
    return out
  }
  const migrated = rewrite(project) as T
  migrated.materials = migrated.materials.map((m) => active[m.id] ? { ...m, id: active[m.id]! } : m)
  return migrated
}
