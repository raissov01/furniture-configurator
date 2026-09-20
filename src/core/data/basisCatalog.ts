/**
 * Базис-Мебельщик 2023All каталогынан импортталған материалдар (docs/basis/import.md).
 *
 * Дерек `scripts/importBasis.mjs` жасайды (`docs/basis/basis-filtered-raw.json`-дан),
 * осы файл тек оны типтеп экспорттайды — қолмен өзгертпе, скриптті қайта жүргіз.
 *
 * `SEED_CATALOG` (`../seed.ts`) ӨЗГЕРТІЛМЕДІ — бұл БӨЛЕК, қосымша каталог.
 * Пайдаланушы екеуін біріктіріп қолдана алады: `{ materials: [...SEED_MATERIALS,
 * ...BASIS_MATERIALS], edgeBands: [...SEED_EDGE_BANDS, ...BASIS_EDGE_BANDS] }`.
 *
 * ⚠ БАҒА: барлық `pricePerSheet`/`pricePerMeter` 0 («белгісіз»), ТЕК Egger
 * 2800×2070 ЛДСП-де qdesign-нан оқылған жалпы ҚР бағасы бар (34 000 ₸/парақ,
 * декорға бөлінбеген). Толық негіздеме — `docs/basis/import.md` §2.
 * Әр жазбаның баға сенімділігі — `basisPriceMeta.ts` (`BASIS_PRICE_META`).
 */
import type { Catalog, EdgeBand, Material } from '../types'
import basisEdgeBandsData from './generated/basisEdgeBands.json'
import basisMaterialsData from './generated/basisMaterials.json'

export const BASIS_MATERIALS: Material[] = basisMaterialsData as Material[]
export const BASIS_EDGE_BANDS: EdgeBand[] = basisEdgeBandsData as EdgeBand[]

export const BASIS_CATALOG: Catalog = {
  materials: BASIS_MATERIALS,
  edgeBands: BASIS_EDGE_BANDS,
}
