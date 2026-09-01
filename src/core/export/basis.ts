/**
 * Экспорт для «Базиса» (Базис-Мебельщик / Базис-Раскрой).
 *
 * ⚠ ЕҢ МАҢЫЗДЫ ЕРЕЖЕ — ӨЛШЕМ. Базиске **ГОТОВЫЙ** өлшем беріледі, рез өлшемі
 * ЕМЕС. Базис кромканы өзі шегереді: детальге кромка тағайындалғанда ол рез
 * өлшемін өзі есептейді. Егер біз рез өлшемін берсек, ол ТАҒЫ БІР РЕТ
 * шегеріледі де, цех детальді 2–4 мм кіші кесіп қояды. Бұл — байқалмайтын әрі
 * қымбат қате, сондықтан осында да, тестте де ашық жазылған (§4.3).
 *
 * ФОРМАТ ТУРАЛЫ ШЫНЫН АЙТУ. Базистің өз ішкі жоба файлы жабық: біз оны
 * жазбаймыз әрі жаза алмаймыз. Бұл жердегі шығыс — Базис-Раскройдың
 * «мәтіндік файлдан импорт» жолы: нүктелі үтірмен бөлінген CSV, бағандарын
 * цех импорт кезінде БІР РЕТ сәйкестендіреді (Базис бағандарды өзі
 * сұрайды). Сондықтан баған атаулары адам оқитындай жазылған.
 *
 * КОДТАУ. Базис — Windows бағдарламасы, ол мәтіндік файлды әдетте
 * **Windows-1251** деп оқиды. UTF-8 берсек, кириллица «кракозябра» болып
 * шығады. Сол себепті мұнда CP1251 кодтауышы бар (`toCp1251`).
 */

import { groupPanels } from '../cutList'
import type { Catalog, Drill, EdgeSpec, Panel } from '../types'

/**
 * Windows-1251 кодтауы.
 *
 * Кестенің өзі шағын: ASCII сол күйінде, кириллица екі үзіліссіз блокта
 * (А–я → 0xC0–0xFF), қалған бірнеше таңба бөлек. Бұл — толық Unicode
 * кодтауышы емес, бізге керегі: орысша/қазақша әріптер, сандар, тыныс
 * белгілері. Кестеде жоқ таңба «?» болып шығады (үнсіз ЖОҒАЛМАЙДЫ —
 * тесті бар), себебі жоғалған таңба цехта танылмайтын атау береді.
 */
const CP1251_EXTRA: Record<string, number> = {
  '€': 0x88, '‚': 0x82, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  '‰': 0x89, '‹': 0x8b, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99, '›': 0x9b, ' ': 0xa0,
  '§': 0xa7, 'Ё': 0xa8, '©': 0xa9, '«': 0xab, '¬': 0xac, '®': 0xae,
  '°': 0xb0, '±': 0xb1, 'ё': 0xb8, '№': 0xb9, '»': 0xbb, '×': 0xd7,
  'Ў': 0xa1, 'ў': 0xa2, 'Ј': 0xa3, 'Ґ': 0xa5, 'І': 0xb2, 'і': 0xb3,
  'ґ': 0xb4, 'µ': 0xb5, '¶': 0xb6, '·': 0xb7, 'Є': 0xaa, 'є': 0xba,
  'Ї': 0xaf, 'ї': 0xbf, 'Ѕ': 0xbd, 'ѕ': 0xbe, 'Њ': 0x8a, 'њ': 0x9a,
}

/** Кестеде жоқ таңбаның орнына не жазылады. */
export const CP1251_REPLACEMENT = '?'

export function toCp1251(text: string): Uint8Array {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    const code = ch.codePointAt(0)!

    if (code < 0x80) {
      out[i] = code
      continue
    }
    // А..я — үзіліссіз блок: U+0410..U+044F → 0xC0..0xFF.
    if (code >= 0x0410 && code <= 0x044f) {
      out[i] = code - 0x0410 + 0xc0
      continue
    }
    const extra = CP1251_EXTRA[ch]
    out[i] = extra ?? CP1251_REPLACEMENT.charCodeAt(0)
  }
  return out
}

/** Қазақ әріптері CP1251-де ЖОҚ. Цехтың атауы танылмай қалмауы үшін тексеру. */
export function unsupportedInCp1251(text: string): string[] {
  const bad = new Set<string>()
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code < 0x80) continue
    if (code >= 0x0410 && code <= 0x044f) continue
    if (CP1251_EXTRA[ch] !== undefined) continue
    bad.add(ch)
  }
  return [...bad]
}

const escape = (value: string): string =>
  /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

const line = (cells: (string | number)[]): string =>
  cells.map((c) => escape(String(c))).join(';')

export type BasisExportOptions = {
  projectName: string
  /** Тапсырыс нөмірі — Базисте жоба солай аталады. Берілмесе, жоба аты. */
  orderId?: string
}

/**
 * Детальдер тізімі.
 *
 * Өлшем — ГОТОВЫЙ (жоғарыдағы ережені қара). Кромка миллиметрмен беріледі:
 * Базисте кромка материал ретінде тағайындалады, ал қалыңдығы оның қайсысы
 * екенін бірмәнді көрсетеді (0.4 / 1 / 2 мм).
 */
export function basisPartsCsv(
  panels: Panel[],
  catalog: Catalog,
  options: BasisExportOptions,
): string {
  const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))
  const band = (e: EdgeSpec): string => {
    if (!e) return '0'
    const found = bands.get(e.bandId)
    if (!found) throw new Error(`Кромка табылмады: ${e.bandId}`)
    return found.thickness.toFixed(1)
  }

  const header = [
    '№', 'Заказ', 'Наименование', 'Материал', 'Толщина',
    'Длина готовая', 'Ширина готовая', 'Количество',
    'Кромка L1', 'Кромка L2', 'Кромка W1', 'Кромка W2',
    'Текстура', 'Примечание',
  ]

  const rows = groupPanels(panels, catalog).map((group, i) => {
    const panel = panels.find((p) => p.id === group.panelIds[0])!
    const material = materials.get(panel.materialId)!
    return line([
      i + 1,
      options.orderId ?? options.projectName,
      group.row.name,
      material.name,
      material.thickness,
      // ⚠ ГОТОВЫЙ өлшем. Рез өлшемін берсек, Базис кромканы ЕКІНШІ РЕТ шегереді.
      group.row.finishedLength,
      group.row.finishedWidth,
      group.row.qty,
      band(panel.edges.L1), band(panel.edges.L2),
      band(panel.edges.W1), band(panel.edges.W2),
      material.hasGrain ? (panel.grainAlongLength ? 'вдоль' : 'поперёк') : 'нет',
      group.row.note,
    ])
  })

  return [line(header), ...rows].join('\r\n')
}

const DRILL_PURPOSE_RU: Record<Drill['purpose'], string> = {
  confirmat: 'конфирмат',
  dowel: 'шкант',
  minifix: 'минификс',
  shelfPin: 'полкодержатель',
  hinge: 'петля',
  runner: 'направляющая',
  handle: 'ручка',
}

const DRILL_FACE_RU: Record<Drill['face'], string> = {
  inner: 'пласть внутренняя',
  outer: 'пласть наружная',
  edgeL1: 'торец L1',
  edgeL2: 'торец L2',
  edgeW1: 'торец W1',
  edgeW2: 'торец W2',
}

/**
 * Присадка. Координаталар — РЕЗ детальінде (станок соны көреді, §4.9), және
 * бұл детальдер тізіміндегі ГОТОВЫЙ өлшемге қайшы емес: бірі детальдің
 * өзін сипаттайды, екіншісі — бұрғының жолын.
 */
export function basisDrillingCsv(panels: Panel[], options: BasisExportOptions): string {
  const header = ['Заказ', 'Деталь', 'Сторона', 'X', 'Y', 'Диаметр', 'Глубина', 'Назначение']
  const rows: string[] = []
  for (const panel of panels) {
    for (const drill of panel.drilling) {
      rows.push(line([
        options.orderId ?? options.projectName,
        panel.label,
        DRILL_FACE_RU[drill.face],
        drill.x, drill.y,
        drill.diameter, drill.depth,
        DRILL_PURPOSE_RU[drill.purpose],
      ]))
    }
  }
  return [line(header), ...rows].join('\r\n')
}

/**
 * Базиске арналған буманың құрамы. Файлдардың бәрі CP1251-де, жол соңы CRLF —
 * Windows бағдарламасы дәл солай күтеді.
 *
 * DXF-тер мұнда ҚОСЫЛМАЙДЫ: оларды шақырушы жағы қосады (`cabinetToDxfFiles`),
 * себебі ядро zip жасамайды.
 */
export function basisFiles(
  panels: Panel[],
  catalog: Catalog,
  options: BasisExportOptions,
): Map<string, Uint8Array> {
  return new Map([
    ['detali.csv', toCp1251(basisPartsCsv(panels, catalog, options))],
    ['prisadka.csv', toCp1251(basisDrillingCsv(panels, options))],
    ['README.txt', toCp1251(README)],
  ])
}

const README = [
  'Экспорт для Базиса',
  '',
  'detali.csv    — список деталей: ГОТОВЫЙ размер + кромка по сторонам.',
  'prisadka.csv  — отверстия: координаты на РЕЗАНОЙ детали.',
  '',
  'ВАЖНО. Размеры деталей — готовые, с учётом кромки. Базис вычитает кромку',
  'сам, когда вы назначаете кромочный материал. Не включайте вычитание',
  'дважды: иначе детали выйдут меньше на толщину кромки.',
  '',
  'Кодировка файлов — Windows-1251, разделитель — точка с запятой,',
  'конец строки — CRLF. При импорте в Базис-Раскрой сопоставьте колонки',
  'один раз, дальше шаблон импорта сохранится.',
].join('\r\n')
