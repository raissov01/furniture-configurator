/**
 * Материалдар мен кромка кітапханасының бастапқы деректері (PHASE-2 A4).
 * Қазақстан цехтары нақты сатып алатын позициялар.
 *
 * БАҒА. `pricePerSheet` пен `pricePerMeter` әдейі 0 — олар жеткізушіге және
 * айға қарай өзгереді, ал ойдан жазылған баға клиентке кеткен КП-ға түседі.
 * Цех өз бағасын өзі енгізеді; бағасы 0 материалмен КП шығаруға тыйым салынады
 * (баға модулі, §6).
 */

import type { EdgeBand, Material } from './types'

/** Кромка декорға байланады: декоры сәйкес келмеген кромка — брак. */
type Decor = { code: string; name: string; hasGrain: boolean }

const DECORS: Decor[] = [
  // Бір түсті декорда текстура ЖОҚ → раскройда детальді 90°-қа бұруға болады,
  // қалдық азаяды. Ағаш декорда бұруға БОЛМАЙДЫ. Осыны шатастыру тікелей ақша.
  { code: 'w980', name: 'Белый платиновый W980', hasGrain: false },
  { code: 'u104', name: 'Серый пыльный U104', hasGrain: false },
  { code: 'h1145', name: 'Дуб Бардолино H1145', hasGrain: true },
  { code: 'h3303', name: 'Дуб Небраска H3303', hasGrain: true },
]

/** ПВХ кромка қалыңдықтары. 0.4 — жасырын жиек, 2 — көрінетін/қол тиетін жиек. */
const BAND_THICKNESSES = [0.4, 1, 2] as const

export const SEED_EDGE_BANDS: EdgeBand[] = DECORS.flatMap((d) =>
  BAND_THICKNESSES.map((th) => ({
    id: `pvc${String(th).replace('.', '')}-${d.code}`,
    name: `Кромка ПВХ ${th} мм ${d.name}`,
    thickness: th,
    pricePerMeter: 0,
  })),
).concat([
  // МДФ фасадқа АБС — бояуға төзімді, ПВХ-дан ыстыққа берік.
  { id: 'abs2-paint', name: 'Кромка АБС 2 мм под покраску', thickness: 2, pricePerMeter: 0 },
])

const edgingFor = (code: string) => ({
  visibleFront: `pvc2-${code}`,
  visibleSecondary: `pvc04-${code}`,
  hidden: null,
})

/** Egger/Kronospan стандарт форматы. */
const SHEET_2800 = { sheetWidth: 2800, sheetHeight: 2070 }
/** Kronospan RU форматы — кейбір жеткізушіде тек осы бар. */
const SHEET_2750 = { sheetWidth: 2750, sheetHeight: 1830 }

export const SEED_MATERIALS: Material[] = [
  ...DECORS.flatMap((d): Material[] => [
    {
      id: `ldsp16-${d.code}`,
      name: `ЛДСП ${d.name} 16 мм`,
      thickness: 16,
      ...SHEET_2800,
      hasGrain: d.hasGrain,
      pricePerSheet: 0,
      trimEdge: 10,
      defaultEdging: edgingFor(d.code),
    },
    {
      id: `ldsp18-${d.code}`,
      name: `ЛДСП ${d.name} 18 мм`,
      thickness: 18,
      ...SHEET_2800,
      hasGrain: d.hasGrain,
      pricePerSheet: 0,
      trimEdge: 10,
      defaultEdging: edgingFor(d.code),
    },
  ]),
  {
    id: 'ldsp16-kr-w980',
    name: 'ЛДСП Белый платиновый W980 16 мм (формат 2750×1830)',
    thickness: 16,
    ...SHEET_2750,
    hasGrain: false,
    pricePerSheet: 0,
    trimEdge: 10,
    defaultEdging: edgingFor('w980'),
  },
  {
    id: 'hdf3-white',
    name: 'ХДФ 3 мм белый',
    thickness: 3,
    ...SHEET_2800,
    hasGrain: false,
    pricePerSheet: 0,
    trimEdge: 10,
    // Арт қабырғаға кромка жабыспайды.
    defaultEdging: { visibleFront: null, visibleSecondary: null, hidden: null },
  },
  {
    id: 'hdf3-brown',
    name: 'ХДФ 3 мм коричневый',
    thickness: 3,
    ...SHEET_2800,
    hasGrain: false,
    pricePerSheet: 0,
    trimEdge: 10,
    defaultEdging: { visibleFront: null, visibleSecondary: null, hidden: null },
  },
  {
    id: 'mdf16-paint',
    name: 'МДФ 16 мм под покраску (фрезерованный фасад)',
    thickness: 16,
    ...SHEET_2800,
    hasGrain: false,
    pricePerSheet: 0,
    trimEdge: 10,
    defaultEdging: { visibleFront: 'abs2-paint', visibleSecondary: 'abs2-paint', hidden: null },
  },
  {
    id: 'mdf19-paint',
    name: 'МДФ 19 мм под покраску',
    thickness: 19,
    ...SHEET_2800,
    hasGrain: false,
    pricePerSheet: 0,
    trimEdge: 10,
    defaultEdging: { visibleFront: 'abs2-paint', visibleSecondary: 'abs2-paint', hidden: null },
  },
]

export const SEED_CATALOG = { materials: SEED_MATERIALS, edgeBands: SEED_EDGE_BANDS }
