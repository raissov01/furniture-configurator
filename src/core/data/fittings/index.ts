/** Өндірушілердің ашық техникалық кестелерінен алынған артикулдық каталог.
 * Сан жоқ жерде null қалады: бұрғылау үшін оны басқа артикулдан алмастыруға болмайды.
 */
import { z } from 'zod'
import { ConfigValidationError } from '../../errors'
import research from './research.json'

const SourceSchema = z.object({
  id: z.string().min(1), publisher: z.string().min(1), document: z.string().min(1),
  url: z.url(), documentPage: z.string().min(1), publishedDate: z.string().nullable(),
  accessedAt: z.iso.date(), note: z.string(), licenseNote: z.string().optional(),
})

const EdgeDatumSchema = z.object({
  reference: z.string().optional(), value: z.number().nullable().optional(),
  minimum: z.number().optional(), maximum: z.number().optional(),
  cupCentreFormula: z.string().optional(), fromCabinetFrontEdge: z.number().optional(),
  fromShownDrawerSideDatum: z.number().optional(), sourceDatum: z.string().optional(),
  patternOptions: z.array(z.number()).optional(),
})

const DrillOperationSchema = z.object({
  operation: z.string().min(1), face: z.enum([
    'front-inner-face', 'cabinet-side-inner-face', 'drawer-side-face',
    'lift-inner-side-or-top', 'front-inner-face-bracket',
  ]),
  diameterMm: z.number().positive().nullable(),
  depthMm: z.union([z.number().positive(), z.object({ minimum: z.number().positive() })]).nullable(),
  edgeDistanceMm: EdgeDatumSchema.nullable(),
  pitchMm: z.number().positive().nullable(),
  sourceIds: z.array(z.string().min(1)).min(1),
  notes: z.string().optional(),
})

const ProductSchema = z.object({
  id: z.string().min(1), brand: z.string().min(1), family: z.string().min(1),
  kind: z.enum(['hinge', 'concealed-runner', 'roller-runner', 'ball-runner', 'box-system', 'lift']),
  variant: z.string().min(1), articleExamples: z.array(z.string()),
  keyDimensions: z.record(z.string(), z.unknown()),
  drilling: z.array(DrillOperationSchema).min(1),
  shopProfile: z.record(z.string(), z.unknown()),
  sourceIds: z.array(z.string().min(1)).min(1),
})

const CatalogSchema = z.object({
  schemaVersion: z.literal(1), asOf: z.iso.date(), sources: z.array(SourceSchema).min(1),
  products: z.array(ProductSchema).min(1),
})

export type FittingSource = z.infer<typeof SourceSchema>
export type FittingProduct = z.infer<typeof ProductSchema>
export type FittingOperation = z.infer<typeof DrillOperationSchema>
export type FittingHole = { along: number; across: number; diameter: number; depth: number }

export function parseFittingsCatalog(raw: unknown): z.infer<typeof CatalogSchema> {
  const catalog = CatalogSchema.parse(raw)
  const sourceIds = new Set<string>()
  for (const source of catalog.sources) {
    if (sourceIds.has(source.id)) throw new Error(`fittings.sources: қайталанған id ${source.id}`)
    sourceIds.add(source.id)
  }
  const productIds = new Set<string>()
  for (const product of catalog.products) {
    if (productIds.has(product.id)) throw new Error(`fittings.products: қайталанған id ${product.id}`)
    productIds.add(product.id)
    for (const id of [...product.sourceIds, ...product.drilling.flatMap((row) => row.sourceIds)]) {
      if (!sourceIds.has(id)) throw new Error(`fittings.products.${product.id}: дереккөз табылмады ${id}`)
    }
  }
  return catalog
}

export const FITTINGS_CATALOG = parseFittingsCatalog(research)
const BY_ID = new Map(FITTINGS_CATALOG.products.map((product) => [product.id, product]))
const SOURCES = new Map(FITTINGS_CATALOG.sources.map((source) => [source.id, source]))

export function fittingById(id: string): FittingProduct | undefined { return BY_ID.get(id) }

/** Құжаттың сандық жолдары. Бұл кесте дайын CNC нұсқауы дегенді білдірмейді. */
export function fittingDrillingTable(id: string): Array<FittingOperation & { sources: FittingSource[] }> {
  const product = BY_ID.get(id)
  if (!product) throw new ConfigValidationError('fittingProductId', `артикул табылмады: ${id}`)
  return product.drilling.map((row) => ({
    ...row,
    sources: row.sourceIds.map((sourceId) => {
      const source = SOURCES.get(sourceId)
      if (!source) throw new Error(`fittings.sources: ${sourceId}`)
      return source
    }),
  }))
}

function missing(id: string, operation: string, field: string): never {
  throw new ConfigValidationError('fittingProductId',
    `${id}: ${operation}.${field} ресми сызбада жоқ; артикулдың нақты шаблоны керек`)
}

/** Топсаның бір бекіту нүктесіне қатысты фасад тесіктері; осьтер: биіктік, ен. */
export function resolveHingeFrontPattern(
  id: string, cupFromEdge: number, frontThickness: number,
  mount: 'cup-only' | 'screw' | 'press-fit',
): FittingHole[] {
  const product = BY_ID.get(id)
  if (!product || product.kind !== 'hinge') {
    throw new ConfigValidationError('fittingProductId', `топса артикулы табылмады: ${id}`)
  }
  const cup = product.drilling.find((row) => row.operation === 'blindCup')
  if (!cup) return missing(id, 'blindCup', 'operation')
  const diameter = cup.diameterMm ?? missing(id, 'blindCup', 'diameterMm')
  const depth = typeof cup.depthMm === 'number' ? cup.depthMm
    : cup.depthMm?.minimum ?? missing(id, 'blindCup', 'depthMm')
  if (depth >= frontThickness) {
    throw new ConfigValidationError('fittingProductId', `${id}: чашка тереңдігі фасадты тесіп өтеді`,
      `фасад қалыңдығы > ${depth} мм`)
  }
  const datum = cup.edgeDistanceMm
  if (datum?.reference?.includes('K to cup-hole rim')) {
    const k = cupFromEdge - diameter / 2
    if (datum.minimum === undefined || datum.maximum === undefined) return missing(id, 'blindCup', 'K range')
    if (k < datum.minimum || k > datum.maximum) {
      throw new ConfigValidationError('fittingProductId', `${id}: K = ${k} мм паспорт аралығынан тыс`,
        `${datum.minimum}…${datum.maximum} мм`)
    }
  }
  const holes: FittingHole[] = [{ along: 0, across: 0, diameter, depth }]
  if (mount === 'cup-only') return holes
  const fixingOperation = mount === 'press-fit' ? 'blindPressFitSocket' : 'hingeScrewOrEuroFixing'
  // Blum INSERTA-ның Ø8.5 ұясы кәдімгі press-fit ұясы емес: оның тереңдігі
  // бұл зерттеуде жоқ, сондықтан бөлек атымен тексеріледі.
  const fixing = product.drilling.find((row) => row.operation === fixingOperation)
    ?? (mount === 'press-fit' ? product.drilling.find((row) => row.operation === 'blindSocket') : undefined)
  if (!fixing) return missing(id, fixingOperation, 'operation')
  const fixingDiameter = fixing.diameterMm ?? missing(id, fixing.operation, 'diameterMm')
  const fixingDepth = typeof fixing.depthMm === 'number' ? fixing.depthMm
    : fixing.depthMm?.minimum ?? missing(id, fixing.operation, 'depthMm')
  const pitch = fixing.pitchMm ?? cup.pitchMm ?? missing(id, fixing.operation, 'pitchMm')
  const offset = fixing.edgeDistanceMm?.value ?? cup.edgeDistanceMm?.value
    ?? missing(id, fixing.operation, 'offsetMm')
  if (fixingDepth >= frontThickness) {
    throw new ConfigValidationError('fittingProductId', `${id}: бекіткіш ұясы фасадты тесіп өтеді`,
      `фасад қалыңдығы > ${fixingDepth} мм`)
  }
  return [...holes,
    { along: -pitch / 2, across: offset, diameter: fixingDiameter, depth: fixingDepth },
    { along: pitch / 2, across: offset, diameter: fixingDiameter, depth: fixingDepth },
  ]
}

/** Жүгіруші артикулының толық тесіктер кестесін талап етеді; жетпесе CNC тоқтайды. */
export function requireRunnerPattern(id: string): FittingHole[] {
  const product = BY_ID.get(id)
  if (!product || !['concealed-runner', 'roller-runner', 'ball-runner', 'box-system'].includes(product.kind)) {
    throw new ConfigValidationError('fittingProductId', `бағыттаушы артикулы табылмады: ${id}`)
  }
  const row = product.drilling.find((operation) =>
    operation.operation === 'runnerMounting' || operation.operation === 'profileMounting')
  if (!row) return missing(id, 'runnerMounting', 'operation')
  if (row.diameterMm === null) return missing(id, row.operation, 'diameterMm')
  if (row.depthMm === null) return missing(id, row.operation, 'depthMm')
  return missing(id, row.operation, 'article-length hole offsets')
}
