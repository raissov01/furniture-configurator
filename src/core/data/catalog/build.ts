/**
 * Зерттеу файлдарынан толық өз каталогын құрастыру — генератор скрипті
 * (`scripts/buildOwnCatalog.ts`) мен тесттердің ортақ кіру нүктесі.
 */
import type { CatalogSource, OwnCatalogBuild } from './schema'
import { buildOwnCatalog } from './schema'
import type { NormalizeReport, ResearchFile } from './research'
import { normalizeResearch } from './research'
import type { ReferencePrice, SupplierPriceRow } from './referencePrices'
import { linkReferencePrices } from './referencePrices'

export type OwnCatalogBundle = OwnCatalogBuild & {
  sources: CatalogSource[]
  report: NormalizeReport
  referencePrices: ReferencePrice[]
}

export function buildOwnCatalogBundle(files: ResearchFile[], supplierRows: SupplierPriceRow[]): OwnCatalogBundle {
  const { input, report } = normalizeResearch(files)
  const built = buildOwnCatalog(input)
  const referencePrices = linkReferencePrices(
    supplierRows, built.materials, built.materialMeta, built.edgeBands, built.edgeMeta,
  )
  return { ...built, sources: input.sources, report, referencePrices }
}
