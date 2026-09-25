/**
 * Зерттеу файлдары (`input/research/<өндіруші>.json`) → `OwnCatalogInput`.
 *
 * Зерттеу файлы — өндіруші бетінен оқылған ШИКІ факт: кейбір декордың
 * қалыңдығы/форматы жарияланбаған, кейбір кромка сәйкестігі біз жинамаған
 * декорға сілтейді. Мұндай жазба ҚАТЕ емес, ол — ОЛҚЫЛЫҚ: каталогқа кірмейді,
 * бірақ саны `NormalizeReport`-қа жазылады (docs/catalog/sources.md-де көрсетіледі).
 * Ал пішіні бұзылған жазба (бос декор коды, бөлшек қалыңдық) сүзілмейді —
 * оны `validateOwnCatalogInput` өріс атымен қате етіп шығарады.
 */
import type {
  BoardKind, CatalogSource, DecorRecord, DecorRef, EdgeRecord, GrainClass, OwnCatalogInput,
} from './schema'
import { z } from 'zod'
import { decorKey } from './schema'

export type ResearchSource = {
  id: string
  manufacturer: string
  url: string
  what: string
  termsUrl: string | null
  termsNote: string
  reuse: 'facts-ok' | 'unclear' | 'forbidden'
  dateSeen: string
}

export type ResearchMaterial = {
  manufacturer: string
  kind: BoardKind
  decorCode: string
  structureCode: string | null
  productLine: string | null
  name: string
  collection: string | null
  thicknessesMm: number[]
  sheetSizesMm: Array<[number, number]>
  sizeBasis: 'per-decor' | 'range-wide' | 'unknown'
  sizeSourceUrl: string | null
  grain: GrainClass
  grainBasis: string
  sourceUrl: string
  dateSeen: string
  /** Бір бетте бірнеше дереккөз болса — нақтысы; болмаса URL бойынша ізделеді. */
  sourceId?: string
}

export type ResearchEdge = {
  manufacturer: string
  code: string
  /** Кейбір сәйкестік кестесі тек кодты береді (Lamarty → Rehau) — сонда null. */
  name: string | null
  material: EdgeRecord['material']
  thicknessesMm: number[]
  widthsMm: number[]
  matches: DecorRef[]
  sourceUrl: string
  dateSeen: string
  sourceId?: string
}

export type ResearchSkipped = { manufacturer: string; url: string | null; reason: string }

export type ResearchFile = {
  sources: ResearchSource[]
  skipped: ResearchSkipped[]
  materials: ResearchMaterial[]
  edges: ResearchEdge[]
  notes: string
}

export type NormalizeReport = {
  /** Өндіруші бойынша: зерттеуде табылған декор / каталогқа кірген декор. */
  decorsByManufacturer: Record<string, { found: number; included: number }>
  /** Қалыңдығы/форматы жарияланбаған (не белгісіз) декорлар — каталогқа кірмеді. */
  decorsWithoutSizes: number
  /** Қалыңдығы не ені жарияланбаған кромкалар — EdgeBand-қа жайылмады. */
  edgesWithoutSizes: number
  /** Тыйым салынған дереккөзден келген жазбалар — алынып тасталды. */
  forbiddenRecords: number
  /** Біз жинамаған декорға сілтейтін кромка сәйкестіктері — алынып тасталды. */
  unresolvedEdgeMatches: number
  skipped: ResearchSkipped[]
}

/**
 * Жазбаның дереккөзін табу: алдымен `sourceId`, сосын URL-дің ең ұзын
 * префиксі бар дереккөз, соңында сол өндірушінің жалғыз дереккөзі.
 */
function findSource(sources: ResearchSource[], manufacturer: string, url: string, sourceId?: string): ResearchSource | undefined {
  if (sourceId !== undefined) return sources.find((s) => s.id === sourceId)
  const byPrefix = sources
    .filter((s) => url.startsWith(s.url) || s.url === url)
    .sort((a, b) => b.url.length - a.url.length)
  if (byPrefix[0]) return byPrefix[0]
  const own = sources.filter((s) => s.manufacturer.toLowerCase() === manufacturer.toLowerCase())
  return own.length === 1 ? own[0] : own.find((s) => hostOf(s.url) === hostOf(url))
}

/** URL хосты; URL жарамсыз болса — бос жол (оны кейін `validateOwnCatalogInput` ұстайды). */
const hostOf = (url: string): string => /^https?:\/\/([^/?#]+)/.exec(url)?.[1] ?? ''

export function normalizeResearch(files: ResearchFile[]): { input: OwnCatalogInput; report: NormalizeReport } {
  const allSources = files.flatMap((f) => f.sources)
  const sources: CatalogSource[] = []
  const forbiddenIds = new Set<string>()
  for (const s of allSources) {
    if (s.reuse === 'forbidden') { forbiddenIds.add(s.id); continue }
    sources.push({
      id: s.id, manufacturer: s.manufacturer, url: s.url, what: s.what, termsUrl: s.termsUrl,
      termsNote: s.termsNote, reuse: s.reuse, dateSeen: s.dateSeen,
    })
  }

  const report: NormalizeReport = {
    decorsByManufacturer: {}, decorsWithoutSizes: 0, edgesWithoutSizes: 0, forbiddenRecords: 0, unresolvedEdgeMatches: 0,
    skipped: files.flatMap((f) => f.skipped),
  }

  const decors: DecorRecord[] = []
  for (const f of files) {
    for (const m of f.materials) {
      const stat = report.decorsByManufacturer[m.manufacturer] ?? { found: 0, included: 0 }
      report.decorsByManufacturer[m.manufacturer] = stat
      stat.found++
      const src = findSource(f.sources, m.manufacturer, m.sourceUrl, m.sourceId)
      if (src && forbiddenIds.has(src.id)) { report.forbiddenRecords++; continue }
      if (m.sizeBasis === 'unknown' || m.sizeSourceUrl === null ||
          m.thicknessesMm.length === 0 || m.sheetSizesMm.length === 0) {
        report.decorsWithoutSizes++
        continue
      }
      stat.included++
      decors.push({
        manufacturer: m.manufacturer, kind: m.kind, decorCode: m.decorCode, structureCode: m.structureCode,
        productLine: m.productLine, name: m.name, collection: m.collection, thicknessesMm: m.thicknessesMm, sheetSizesMm: m.sheetSizesMm,
        sizeBasis: m.sizeBasis, sizeSourceUrl: m.sizeSourceUrl, grain: m.grain, grainBasis: m.grainBasis,
        sourceId: src?.id ?? '', sourceUrl: m.sourceUrl, dateSeen: m.dateSeen,
      })
    }
  }

  const known = new Set<string>()
  for (const d of decors) {
    known.add(decorKey(d.manufacturer, d.decorCode, d.structureCode))
    known.add(decorKey(d.manufacturer, d.decorCode, null))
  }
  const edges: EdgeRecord[] = []
  for (const f of files) {
    for (const e of f.edges) {
      const src = findSource(f.sources, e.manufacturer, e.sourceUrl, e.sourceId)
      if (src && forbiddenIds.has(src.id)) { report.forbiddenRecords++; continue }
      if (e.thicknessesMm.length === 0 || e.widthsMm.length === 0) { report.edgesWithoutSizes++; continue }
      const matches = e.matches.filter((m) => known.has(decorKey(m.manufacturer, m.decorCode, m.structureCode)))
      report.unresolvedEdgeMatches += e.matches.length - matches.length
      edges.push({
        manufacturer: e.manufacturer, code: e.code, name: e.name ?? e.code, material: e.material,
        thicknessesMm: e.thicknessesMm, widthsMm: e.widthsMm, matches,
        sourceId: src?.id ?? '', sourceUrl: e.sourceUrl, dateSeen: e.dateSeen,
      })
    }
  }
  return { input: { sources, decors, edges }, report }
}

// ── Зерттеу файлының пішінін тексеру (zod) ─────────────────────────────────

const decorRefSchema = z.object({
  manufacturer: z.string(),
  decorCode: z.string(),
  structureCode: z.string().nullable(),
})

const researchFileSchema = z.object({
  sources: z.array(z.object({
    id: z.string(), manufacturer: z.string(), url: z.string(), what: z.string(),
    termsUrl: z.string().nullable(), termsNote: z.string(),
    reuse: z.enum(['facts-ok', 'unclear', 'forbidden']), dateSeen: z.string(),
  })),
  skipped: z.array(z.object({ manufacturer: z.string(), url: z.string().nullable(), reason: z.string() })),
  materials: z.array(z.object({
    manufacturer: z.string(), kind: z.enum(['ldsp', 'mdf', 'hdf']), decorCode: z.string(),
    structureCode: z.string().nullable(), productLine: z.string().nullable().default(null),
    name: z.string(), collection: z.string().nullable(),
    thicknessesMm: z.array(z.number()), sheetSizesMm: z.array(z.tuple([z.number(), z.number()])),
    sizeBasis: z.enum(['per-decor', 'range-wide', 'unknown']), sizeSourceUrl: z.string().nullable(),
    grain: z.enum(['wood', 'none', 'unknown']), grainBasis: z.string(),
    sourceUrl: z.string(), dateSeen: z.string(), sourceId: z.string().optional(),
  })),
  edges: z.array(z.object({
    manufacturer: z.string(), code: z.string(), name: z.string().nullable(),
    material: z.enum(['pvc', 'abs', 'pp', 'unknown']),
    thicknessesMm: z.array(z.number()), widthsMm: z.array(z.number()),
    matches: z.array(decorRefSchema), sourceUrl: z.string(), dateSeen: z.string(),
    sourceId: z.string().optional(),
  })),
  notes: z.string(),
})

/**
 * Зерттеу JSON-ын тексеріп типтеу. Қате болса — файл атауы мен өріс жолы
 * (`materials.12.thicknessesMm.0`) хабарламада аталады.
 */
export function parseResearchFile(data: unknown, fileName: string): ResearchFile {
  const r = researchFileSchema.safeParse(data)
  if (!r.success) {
    const lines = r.error.issues.slice(0, 20).map((i) => `${fileName}: ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Зерттеу файлы жарамсыз (${r.error.issues.length} қате):\n${lines.join('\n')}`)
  }
  const d = r.data
  return {
    sources: d.sources, skipped: d.skipped, notes: d.notes,
    materials: d.materials.map(({ sourceId, ...m }) => (sourceId === undefined ? m : { ...m, sourceId })),
    edges: d.edges.map(({ sourceId, ...e }) => (sourceId === undefined ? e : { ...e, sourceId })),
  }
}
