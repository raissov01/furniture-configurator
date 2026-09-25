/**
 * ӨЗ КАТАЛОГЫМЫЗ — барлық цехқа ортақ, өндірушілердің АШЫҚ каталогтарынан
 * жиналған материал мен кромка (docs/catalog/sources.md).
 *
 * `generated/catalog.json` — генератор (`npm run catalog:build`) тексеріп жазған
 * ықшам декор/кромка жазбалары; `Material`/`EdgeBand`-қа жаю осы жерде, жүктеу
 * кезінде (`buildOwnCatalog`, таза әрі детерминистік). `generated/*.json`-ды
 * қолмен өзгертпе. `BASIS_CATALOG`/`PRO100` ӘЛІ ЖОЙЫЛМАДЫ: көшу — бөлек тапсырма.
 *
 * БАҒА: `pricePerSheet`/`pricePerMeter` бәрінде 0. Жеткізушінің ашық бағасы —
 * тек «Анықтамалық (жеткізуші)» парағында (`OWN_REFERENCE_PRICES`), ол
 * материалға автоматты жазылмайды.
 */
import type { Catalog, EdgeBand, Material } from '../../types'
import type { CatalogSource, OwnCatalogBuild, OwnCatalogInput } from './schema'
import { buildOwnCatalog } from './schema'
import type { NormalizeReport, ResearchSkipped } from './research'
import type { ReferencePrice } from './referencePrices'
import catalogData from './generated/catalog.json'
import referencePricesData from './generated/referencePrices.json'
import sourcesData from './generated/sources.json'
import reportData from './generated/report.json'

export * from './schema'
export * from './research'
export * from './referencePrices'
export * from './build'

/** Генератор тексерген кіріс (декор/кромка жазбалары, дереккөздерімен). */
export const OWN_CATALOG_INPUT: OwnCatalogInput = catalogData as OwnCatalogInput

let built: OwnCatalogBuild | undefined

/**
 * Material/EdgeBand-қа жайылған каталог — ЖАЛҚАУ әрі бір рет: 6 мыңнан астам
 * материалды жаю ~0.5 с алады, ал ядроны импорттайтын әр модуль (UI, тест)
 * оны қолданбайды. Алғаш сұралғанда құрастырылады да, кэште қалады.
 */
export function ownCatalogBuild(): OwnCatalogBuild {
  built ??= buildOwnCatalog(OWN_CATALOG_INPUT, { validate: false })
  return built
}

export const OWN_REFERENCE_PRICES: ReferencePrice[] = referencePricesData as ReferencePrice[]
export const OWN_CATALOG_SOURCES: { sources: CatalogSource[]; skipped: ResearchSkipped[] } =
  sourcesData as { sources: CatalogSource[]; skipped: ResearchSkipped[] }
export const OWN_CATALOG_REPORT: Omit<NormalizeReport, 'skipped'> & { skipped: number } =
  reportData as Omit<NormalizeReport, 'skipped'> & { skipped: number }

/**
 * Өз каталогы — `BASIS_CATALOG`/`SEED_CATALOG` сияқты `Catalog`. Өрістері
 * getter: `ownCatalogBuild()`-ті алғаш оқығанда ғана іске қосады.
 */
export const OWN_CATALOG: Catalog = {
  get materials(): Material[] { return ownCatalogBuild().materials },
  get edgeBands(): EdgeBand[] { return ownCatalogBuild().edgeBands },
}
