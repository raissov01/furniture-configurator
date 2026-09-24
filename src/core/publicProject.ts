import type { ProjectFile } from './types'
import type { ProjectFileV4 } from './projectV4'
import { discountAmount } from './pricing'

type SavedProject = ProjectFile | ProjectFileV4

/** A shop-floor copy keeps geometry but carries no commercial inputs. */
export function toProductionProject<T extends SavedProject>(project: T): T {
  return {
    ...project,
    materials: project.materials.map(({ slab, ...material }) => ({
      ...material,
      pricePerSheet: 0,
      ...(slab ? { slab: { stockLengths: slab.stockLengths, pricePerMeter: 0 } } : {}),
    })),
    edgeBands: project.edgeBands.map((band) => ({ ...band, pricePerMeter: 0 })),
    priceOverrides: undefined,
  } as T
}

/** Shareable copy: the manually agreed sale price is the sole price retained. */
export function toPublicProject<T extends SavedProject>(project: T): T {
  const production = toProductionProject(project)
  const overrides = project.priceOverrides
  // Жолдық жеңілдікті бағалар өшірілгеннен кейін қайта есептеу мүмкін емес.
  // Дәл соңғы сома белгілі болмаса клиентке бастапқы бағаны көрсетпейміз.
  const hasLineDiscounts = Object.keys(overrides?.lineDiscounts ?? {}).length > 0
  const salePrice = overrides?.salePrice
  const finalPrice = salePrice === undefined || hasLineDiscounts ? undefined
    : salePrice - (overrides?.overallDiscount
      ? discountAmount(overrides.overallDiscount, salePrice, 'priceOverrides.overallDiscount') : 0)
  return {
    ...production,
    materials: production.materials.map(({ slab: _slab, ...material }) => material),
    info: undefined,
    priceOverrides: finalPrice === undefined ? undefined : { salePrice: finalPrice },
  } as T
}
