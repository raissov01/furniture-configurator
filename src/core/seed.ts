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
type DecorSeed = { code: string; name: string; hasGrain: boolean; color: string }

/**
 * Түстер — сол декорлардың нақты реңкіне жуықтатылған. Олар ӨНДІРІСКЕ әсер
 * етпейді: тек 3D мен таңдағышта плита шын түсімен көрінуі үшін.
 */
const DECORS: DecorSeed[] = [
  // Бір түсті декорда текстура ЖОҚ → раскройда детальді 90°-қа бұруға болады,
  // қалдық азаяды. Ағаш декорда бұруға БОЛМАЙДЫ. Осыны шатастыру тікелей ақша.
  { code: 'w980', name: 'Белый платиновый W980', hasGrain: false, color: '#eeece7' },
  { code: 'u104', name: 'Серый пыльный U104', hasGrain: false, color: '#9c9a94' },
  { code: 'h1145', name: 'Дуб Бардолино H1145', hasGrain: true, color: '#b98d57' },
  { code: 'h3303', name: 'Дуб Небраска H3303', hasGrain: true, color: '#8d6c47' },
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
      decor: { color: d.color, kind: d.hasGrain ? 'wood' : 'solid' },
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
      decor: { color: d.color, kind: d.hasGrain ? 'wood' : 'solid' },
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
    decor: { color: '#eeece7', kind: 'solid' },
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
    decor: { color: '#f2f1ec', kind: 'solid' },
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
    decor: { color: '#6f5741', kind: 'solid' },
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
    decor: { color: '#e6e3dd', kind: 'solid' },
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
    decor: { color: '#e6e3dd', kind: 'solid' },
  },
  /*
   * ПОСТФОРМИНГ СТОЛЕШНИЦА 38 мм (пайдаланушы, 09-13): дайын тақта, жеткізуші
   * 3050/4100 мм ұзындықпен сатады. Раскройға кірмейді (`slab`), сметаға —
   * метрмен. Алдыңғы жиегі заводта иілген (постформинг) — кромка ЖОҚ.
   * Парақ өлшемдері тақтада қолданылмайды; тек схема талабы үшін тұр.
   */
  ...([
    { code: 'stone', name: 'Серый камень', color: '#8f8c86', kind: 'solid' as const },
    { code: 'oak', name: 'Дуб', color: '#a9805a', kind: 'wood' as const },
  ]).map((d): Material => ({
    id: `pf38-${d.code}`,
    name: `Столешница постформинг 38 мм ${d.name}`,
    thickness: 38,
    sheetWidth: 4100,
    sheetHeight: 600,
    hasGrain: false,
    pricePerSheet: 0,
    trimEdge: 0,
    defaultEdging: { visibleFront: null, visibleSecondary: null, hidden: null },
    decor: { color: d.color, kind: d.kind },
    slab: { stockLengths: [3050, 4100], pricePerMeter: 0 },
  })),
]

export const SEED_CATALOG = { materials: SEED_MATERIALS, edgeBands: SEED_EDGE_BANDS }
