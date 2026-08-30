/**
 * Лендингтегі нақты мысал.
 *
 * Беттегі сурет те, кесте де ҚОЛМЕН ЖАЗЫЛМАЙДЫ — олар конфигураторда істейтін
 * ЯДРОНЫҢ өзі есептеген нәтиже. Сондықтан лендинг ешқашан өтірік айта алмайды:
 * ядро өзгерсе, беттегі сан да өзгереді.
 *
 * Бағалар — МЫСАЛ. Нақты цехтың бағасы оның профилінде тұрады, ал бұл жерде
 * КП қалай көрінетінін көрсету үшін ғана орташа сандар алынған.
 */

import {
  defaultShopProfile,
  findTemplate,
  formatCutList,
  generateCabinet,
  nestPanels,
  priceProject,
  templateToCabinet,
} from '@/src/core/index'
import type { ShopProfile } from '@/src/core/index'

/** Мысалдағы бағалар, тиынмен. Астанадағы орташа деңгей, дәл сан емес. */
const DEMO_PRICES = {
  ldsp16: 2_850_000,
  hdf3: 480_000,
  band: 9_000,
  hardware: 6_000,
  labourPerM2: 150_000,
  labourPerHole: 3_000,
  labourPerEdgeMetre: 5_000,
  markupPercent: 25,
}

const base = defaultShopProfile('demo')

export const demoShop: ShopProfile = {
  ...base,
  name: 'Ваш цех',
  city: 'Астана',
  materials: base.materials.map((m) => ({
    ...m,
    pricePerSheet: m.thickness < 10 ? DEMO_PRICES.hdf3 : DEMO_PRICES.ldsp16,
  })),
  edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: DEMO_PRICES.band })),
  hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: DEMO_PRICES.hardware })),
  labour: {
    perSquareMetre: DEMO_PRICES.labourPerM2,
    perHole: DEMO_PRICES.labourPerHole,
    perEdgeMetre: DEMO_PRICES.labourPerEdgeMetre,
  },
  markupPercent: DEMO_PRICES.markupPercent,
}

const demoCatalog = { materials: demoShop.materials, edgeBands: demoShop.edgeBands }

/** Үш секциялы шкаф — бір корпуста перегородка да, фасад та, сөре де бар. */
export const demoCabinet = templateToCabinet(findTemplate('wardrobe-3sec-1800')!, demoCatalog)
export const demoPanels = generateCabinet(demoCabinet, demoCatalog)
export const demoRows = formatCutList(demoPanels, demoCatalog)
export const demoNesting = nestPanels(demoPanels, demoCatalog)
export const demoPrice = priceProject(demoPanels, demoNesting, demoShop)

/** Ең көп деталь түскен парақ — беттің басты суреті. */
export const demoSheet = demoNesting.byMaterial
  .flatMap((m) => m.sheets.map((s) => ({ sheet: s, materialName: m.materialName, waste: m.wastePercent })))
  .sort((a, b) => b.sheet.parts.length - a.sheet.parts.length)[0]!
