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
import type { Catalog, Drill, EdgeSpec, Panel, SettingsOverride } from '../types'
import { basisScriptBytes } from './basisScript'
import type { BasisScriptScene } from './basisScript'
import { simpleTableXlsx } from './xlsx'

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
  /**
   * Берілсе, бумаға Базис-Мебельщиктің СКРИПТІ қосылады (`basisScript.ts`):
   * панельдер ӘЛЕМДЕГІ орнымен + присадка крепеж ретінде. Сахна керек, себебі
   * скриптке панельдің позасы (`flattenTree`) қажет, ал деталь тізіміне — жоқ.
   */
  script?: { scene: BasisScriptScene; settings?: SettingsOverride | undefined } | undefined
}

/** Бумадағы скрипттің аты: ASCII — Базистің «Скрипты» мәзірінде солай көрінеді. */
export const BASIS_SCRIPT_FILE = 'bazis-import.js'

/**
 * Детальдер тізімі.
 *
 * Өлшем — ГОТОВЫЙ (жоғарыдағы ережені қара). Кромка миллиметрмен беріледі:
 * Базисте кромка материал ретінде тағайындалады, ал қалыңдығы оның қайсысы
 * екенін бірмәнді көрсетеді (0.4 / 1 / 2 мм).
 */
const PART_HEADER = [
  '№', 'Заказ', 'Наименование', 'Материал', 'Толщина',
  'Длина готовая', 'Ширина готовая', 'Количество',
  'Кромка L1', 'Кромка L2', 'Кромка W1', 'Кромка W2',
  'Текстура', 'Примечание',
]

type PartRow = {
  no: number
  order: string
  name: string
  material: string
  thickness: number
  length: number
  width: number
  qty: number
  /** Кромка қалыңдығы, мм; жоқ болса 0 */
  bands: [number, number, number, number]
  grain: string
  note: string
}

/** Детальдер тізімінің жолдары — CSV мен XLSX бір көзден алады. */
function basisPartRows(panels: Panel[], catalog: Catalog, options: BasisExportOptions): PartRow[] {
  const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))
  const band = (e: EdgeSpec): number => {
    if (!e) return 0
    const found = bands.get(e.bandId)
    if (!found) throw new Error(`Кромка табылмады: ${e.bandId}`)
    return found.thickness
  }
  return groupPanels(panels, catalog).map((group, i) => {
    const panel = panels.find((p) => p.id === group.panelIds[0])!
    const material = materials.get(panel.materialId)!
    return {
      no: i + 1,
      order: options.orderId ?? options.projectName,
      name: group.row.name,
      material: material.name,
      thickness: material.thickness,
      // ⚠ ГОТОВЫЙ өлшем. Рез өлшемін берсек, Базис кромканы ЕКІНШІ РЕТ шегереді.
      length: group.row.finishedLength,
      width: group.row.finishedWidth,
      qty: group.row.qty,
      bands: [band(panel.edges.L1), band(panel.edges.L2), band(panel.edges.W1), band(panel.edges.W2)],
      grain: material.hasGrain ? (panel.grainAlongLength ? 'вдоль' : 'поперёк') : 'нет',
      note: group.row.note,
    }
  })
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
  const rows = basisPartRows(panels, catalog, options).map((r) => line([
    r.no, r.order, r.name, r.material, r.thickness, r.length, r.width, r.qty,
    ...r.bands.map((t) => (t === 0 ? '0' : t.toFixed(1))),
    r.grain, r.note,
  ]))
  return [line(PART_HEADER), ...rows].join('\r\n')
}

/**
 * Сол тізім XLSX-те — Базис-Раскройдың «Импорт из MS Excel» жолы үшін
 * (Раскрой тек xls/xlsx оқиды; импортта «Длину и ширину считывать как
 * готовую» опциясы қосылады). XLSX UTF-8: қазақ әріптері де бұзылмайды.
 */
export function basisPartsXlsx(panels: Panel[], catalog: Catalog, options: BasisExportOptions): Uint8Array {
  const rows = basisPartRows(panels, catalog, options).map((r) => [
    r.no, r.order, r.name, r.material, r.thickness, r.length, r.width, r.qty, ...r.bands, r.grain, r.note,
  ])
  return simpleTableXlsx('Детали', PART_HEADER, rows)
}

const DRILL_PURPOSE_RU: Record<Drill['purpose'], string> = {
  confirmat: 'конфирмат',
  dowel: 'шкант',
  minifix: 'минификс',
  shelfPin: 'полкодержатель',
  hinge: 'петля',
  runner: 'направляющая',
  handle: 'ручка',
  leg: 'ножка',
  facadeScrew: 'евровинт фасада',
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
 * Базиске арналған буманың құрамы.
 *
 *   detali.csv / detali.xlsx — Базис-Раскройға детальдер тізімі (ГОТОВЫЙ өлшем);
 *   bazis-import.js          — Базис-Мебельщикке скрипт: панель + присадка
 *                              (`options.script` берілсе);
 *   README.txt               — түсіндірме.
 *
 * ⚠ `prisadka.csv` ЕНДІ БУМАДА ЖОҚ: Базистің ЕШБІР модулі присадканы CSV-ден
 * оқымайды (`docs/basis/drilling-import-route.md`). Ол «Базиске» деп
 * тұрса, цех оны импорттауға әуре болатын. Присадка Базиске — скрипт арқылы;
 * станокқа — «ЧПУ по деталям» экспорты арқылы. `basisDrillingCsv` функциясы
 * адам оқитын тізім ретінде қалды.
 *
 * CSV мен README — CP1251, CRLF (Windows бағдарламасы солай күтеді). Скрипт —
 * UTF-8 + BOM (ресми мысал солай). DXF-тер мұнда ҚОСЫЛМАЙДЫ: оларды шақырушы
 * жағы қосады (`cabinetToDxfFiles`), себебі ядро zip жасамайды.
 */
export function basisFiles(
  panels: Panel[],
  catalog: Catalog,
  options: BasisExportOptions,
): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>([
    ['detali.csv', toCp1251(basisPartsCsv(panels, catalog, options))],
    ['detali.xlsx', basisPartsXlsx(panels, catalog, options)],
    ['README.txt', toCp1251(README)],
  ])
  if (options.script) {
    files.set(BASIS_SCRIPT_FILE, basisScriptBytes(options.script.scene, catalog, options.script.settings, {
      projectName: options.projectName,
      orderId: options.orderId,
    }))
  }
  return files
}

const README = [
  'Экспорт для Базиса — AisMebel',
  '',
  'detali.csv, detali.xlsx - список деталей для Базис-Раскроя: ГОТОВЫЙ размер',
  '                          + кромка по сторонам. Раскрой читает Excel (xlsx);',
  '                          при импорте включите "Длину и ширину считывать',
  '                          как готовую".',
  'bazis-import.js         - скрипт для Базис-Мебельщика: строит детали на своих',
  '                          местах и ставит присадку как крепёж Базиса.',
  '                          Положите в папку Scripts Базиса и запустите.',
  '                          При первом запуске выберите крепёж Базиса для',
  '                          каждого типа AisMebel (выбор сохранится). В конце',
  '                          скрипт пишет файл сверки ...-bazis-audit.json -',
  '                          отправьте его в AisMebel.',
  '',
  'ПРИСАДКА. Отдельного файла присадки для Базиса нет: ни Базис-Мебельщик,',
  'ни Базис-Раскрой не импортируют отверстия из CSV. Присадка попадает в',
  'Базис только через скрипт. Для станка ЧПУ используйте экспорт',
  '"ЧПУ по деталям".',
  '',
  'ВАЖНО. Размеры деталей - готовые, с учётом кромки. Не вычитайте кромку',
  'дважды: иначе детали выйдут меньше нужного размера.',
  'Правило AisMebel при пороге minBandSubtract=1 мм: кромка 0,4 мм НЕ',
  'уменьшает размер реза, кромка 2 мм уменьшает его на 2 мм с каждой',
  'оклеенной стороны. Пример: готовая длина 600 мм, кромка с двух торцов',
  '0,4 мм -> рез 600 мм; кромка 2 мм -> рез 596 мм.',
  'После импорта в Базис-Раскрой сравните размер реза каждой позиции с',
  'деталировкой AisMebel, особенно позиции с кромкой 0,4 мм. Поведение',
  'Базис-Раскроя для 0,4 мм в реальной установке пока не проверено.',
  'Скрипт API не проверен в реальном Базисе. Перед первым производственным',
  'резом проверьте audit, вырежьте пробную деталь и сверьте её размеры.',
  '',
  'Кодировка CSV - Windows-1251, разделитель - точка с запятой,',
  'конец строки - CRLF. При импорте в Базис-Раскрой сопоставьте колонки',
  'один раз, дальше шаблон импорта сохранится.',
].join('\r\n')
