import type { ProjectFile } from './types'
import type { ProjectFileV4 } from './projectV4'

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
  return {
    ...production,
    materials: production.materials.map(({ slab: _slab, ...material }) => material),
    info: undefined,
    priceOverrides: project.priceOverrides?.salePrice === undefined
      ? undefined : { salePrice: project.priceOverrides.salePrice },
  } as T
}
