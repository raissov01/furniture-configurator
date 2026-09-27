/**
 * ЧПУ присадкасы — **ӘР ДЕТАЛЬГЕ БІР ФАЙЛ**.
 *
 * НЕГЕ БӨЛЕК ФАЙЛ. Бізде бұрыннан жалпы тізім бар (`drillingToCsv`,
 * `basisDrillingCsv`): бүкіл жобаның тесіктері бір кестеде, әр жолда
 * детальдің аты. Ол — ҚАҒАЗҒА арналған көрініс: адам оқиды, Базис импорттайды.
 *
 * Присадка станогының операторы басқаша жұмыс істейді: ол детальді үстелге
 * қояды да, СОЛ ДЕТАЛЬДІҢ бағдарламасын жүктейді. Жалпы файл берсек, оператор
 * әр деталь сайын мыңдаған жолдан өзінікін сүзіп отыруы керек — қолмен
 * сүзу деген қате деген сөз. Сондықтан мұнда әр деталь өз файлын алады, ал
 * `index.csv` қайсысы қай файл екенін көрсетеді.
 *
 * КООРДИНАТА — РЕЗ детальінде (§4.9, `Drill` келісімі). Станок кромкаланбаған
 * детальді көреді; готовый өлшемге аударсақ, әр тесік кромканың қалыңдығына
 * жылжып кетер еді.
 *
 * ОЙМА МЕН ПАЗ МҰНДА ЖОҚ. Олар — фрезаның жұмысы, бұрғының емес, әрі контур
 * түрінде беріледі (DXF). Үнсіз қалдырсақ, цех раковинасыз столешница кесіп
 * алар еді, сондықтан `index.csv`-де әр детальге «ойма/паз бар ма» деген
 * баған тұр да, README оны қайдан алуды айтады.
 */
import { pointOnMachinedFace } from '../faceCoordinates'
import { validateJointDrill } from '../autoJoint'

import { transliterate } from './dxf'
import { requireCncReady } from './cncGuard'
import type { Catalog, Drill, Panel } from '../types'

/** Бағандардың ажыратқышы. Неге `;` — README-де жазылған. */
const SEP = ';'

/**
 * UTF-8 BOM.
 *
 * Цехтың машинасы — Windows. BOM-сыз UTF-8 файлды Excel те, станоктың импорт
 * терезесі де 1251 деп оқиды да, кириллица «кракозябраға» айналады. BOM бар
 * болса, екеуі де кодтауды дұрыс таниды. Базистікінен айырмашылығы: онда
 * файлды БАҒДАРЛАМА оқиды әрі ол 1251-ден басқасын білмейді, ал мұндағы
 * файлды АДАМ да ашады — сондықтан мұнда қазақ әріптері сақталады.
 */
export const BOM = '﻿'

const escape = (value: string | number): string => {
  const s = String(value)
  return new RegExp(`["${SEP}\n]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const line = (cells: (string | number)[]): string => cells.map(escape).join(SEP)

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

/** Беттердің реті: оператор детальді неше рет аударатыны осыдан шығады. */
const FACE_ORDER: Drill['face'][] = ['inner', 'outer', 'edgeL1', 'edgeL2', 'edgeW1', 'edgeW2']

/**
 * Тесік ӨТПЕЛІ ме.
 *
 * Бұл станок үшін бөлек мәлімет: өтпелі тесікті бұрғылағанда астына тақтай
 * қойылады, әйтпесе шығу жағы жыртылады. Біздің `Drill`-де жалауша жоқ —
 * оны есептеу керек: беттегі тесіктің тереңдігі материалдың қалыңдығына
 * жетсе, ол өтпелі. Торцтағы тесік бұл мағынада ешқашан өтпелі емес: ол
 * детальдің бойымен жүреді.
 */
export function isThrough(drill: Drill, thickness: number): boolean {
  if (drill.face !== 'inner' && drill.face !== 'outer') return false
  return drill.depth >= thickness
}

/** Файл атына жарайтын, латын әріптерінен тұратын атау. */
export function cncSlug(value: string): string {
  const latin = transliterate(value).toLowerCase()
  return latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'panel'
}

/**
 * Файлдың аты: реттік нөмір + панельдің ИДЕНТИФИКАТОРЫ.
 *
 * ⚠ Аты емес, ИДЕНТИФИКАТОРЫ. Екі боковинаның да аты «Боковина», ал
 * присадкасы әртүрлі болуы мүмкін (ілгек бір жақта, направляющая екінші
 * жақта). Атымен атасақ, `01-bokovina.csv` пен `02-bokovina.csv` шығады да,
 * оператор қайсысы сол, қайсысы оң екенін файлдан білмейді. `side-left` /
 * `side-right` — бірмәнді.
 *
 * Дәл сол идентификатор ДЕТАЛЬДІҢ БИРКАСЫНДА да тұр (`labels.ts`, `panelId`)
 * әрі DXF файлының аты да сол (`cabinetToDxfFiles`). Үшеуі бір-бірімен
 * осылай байланысады: биркадағы жазу → CSV → DXF.
 *
 * Нөмір алдында: бумадағы файлдар деталировканың ретімен тізіледі.
 */
export function cncFileName(panel: Panel, index: number): string {
  return `${String(index + 1).padStart(2, '0')}-${cncSlug(panel.id)}.csv`
}

export type CncOptions = {
  projectName: string
  /** Тапсырыс нөмірі. Берілмесе — жобаның аты. */
  orderId?: string
  /** Сыртқы бетті станокқа қарату үшін айналдыру осі. */
  outerFlipAxis?: 'length' | 'width'
}

/**
 * Бір детальдің бағдарламасы.
 *
 * Тесіктер бет → x → y ретімен жазылады. Реттің екі мағынасы бар: оператор
 * бір бетті бітірмей екіншісіне ауыспайды (деталь бір-ақ рет аударылады),
 * әрі шығыс детерминирленген болады — сол кіріс әрқашан сол файлды береді.
 */
export function cncPanelCsv(panel: Panel, catalog: Catalog, options: CncOptions): string {
  requireCncReady(panel)
  const material = catalog.materials.find((m) => m.id === panel.materialId)
  if (!material) throw new Error(`Материал табылмады: ${panel.materialId}`)

  const header = [
    'Заказ', 'Идентификатор', 'Деталь', 'Материал', 'Толщина', 'Длина реза', 'Ширина реза',
    'Сторона', 'X', 'Y', 'Диаметр', 'Глубина', 'Сквозное', 'Назначение',
  ]

  const holes = [...panel.drilling].sort((a, b) =>
    FACE_ORDER.indexOf(a.face) - FACE_ORDER.indexOf(b.face) || a.x - b.x || a.y - b.y)
  holes.forEach((hole, index) => validateJointDrill(panel, hole, material.thickness,
    `panel[${panel.id}].drilling.${index}`))

  const rows = holes.map((d) => {
    const point = pointOnMachinedFace(panel, d, options.outerFlipAxis ?? 'length')
    return line([
    options.orderId ?? options.projectName,
    panel.id,
    panel.label,
    material.name,
    material.thickness,
    panel.cutLength,
    panel.cutWidth,
    DRILL_FACE_RU[d.face],
    point.x, point.y,
    d.diameter, d.depth,
    isThrough(d, material.thickness) ? 'да' : 'нет',
    DRILL_PURPOSE_RU[d.purpose],
    ])
  })

  return BOM + [line(header), ...rows].join('\r\n') + '\r\n'
}

/**
 * Бумадағы файлдардың картасы.
 *
 * «Аудару» бағаны — детальді екі жағынан да бұрғылау керек пе деген сұрақтың
 * жауабы. Оператор оны файлды ашпай тұрып білгені жөн: жоспарлау да, уақыт
 * есебі де содан басталады.
 */
export function cncIndexCsv(panels: Panel[], catalog: Catalog, options: CncOptions): string {
  const header = [
    'Файл', 'Идентификатор', 'Деталь', 'Материал', 'Толщина', 'Длина реза', 'Ширина реза',
    'Отверстий', 'Переворот', 'Фрезеровка',
  ]
  const rows = panels.map((panel, i) => {
    const material = catalog.materials.find((m) => m.id === panel.materialId)
    if (!material) throw new Error(`Материал табылмады: ${panel.materialId}`)
    const faces = new Set(panel.drilling.map((d) => d.face))
    // K9 / audit C9: трапеция контуры да фрезамен (ойма/паз секілді) ТЕК
    // DXF-те бар — bevel есепке алынбаса, цех «Фрезеровка: нет» деп оқып,
    // дно/крышканы тікбұрыш деп кесіп алады.
    const milled = panel.cutouts.length > 0 || panel.grooves.length > 0 || panel.bevel !== undefined
    return line([
      cncFileName(panel, i),
      // Биркадағы жазумен бірдей: оператор физикалық детальді осымен табады.
      panel.id,
      panel.label,
      material.name,
      material.thickness,
      panel.cutLength,
      panel.cutWidth,
      panel.drilling.length,
      faces.has('inner') && faces.has('outer') ? 'да' : 'нет',
      milled ? 'есть — см. DXF' : 'нет',
    ])
  })
  return BOM + [line(header), ...rows].join('\r\n') + '\r\n'
}

/**
 * Буманың құрамы: индекс + әр детальдің файлы + README.
 *
 * ⚠ ТЕСІГІ ЖОҚ ДЕТАЛЬ ДЕ ФАЙЛ АЛАДЫ (бос кестемен). Себебі индекстегі нөмір
 * деталировкадағы ретпен бірдей болуы керек: тесіксіз детальді өткізіп
 * жіберсек, нөмірлер жылжып кетеді де, оператор 7-файлды 8-детальге
 * қатысты деп ойлауы мүмкін. Бос файл — «мұнда бұрғылайтын ештеңе жоқ»
 * дегеннің ашық жауабы.
 */
export function cncFiles(panels: Panel[], catalog: Catalog, options: CncOptions): Map<string, string> {
  const files = new Map<string, string>()
  files.set('index.csv', cncIndexCsv(panels, catalog, options))
  panels.forEach((panel, i) => {
    files.set(cncFileName(panel, i), cncPanelCsv(panel, catalog, options))
  })
  files.set('README.txt', cncReadme(options.outerFlipAxis ?? 'length'))
  return files
}

function cncReadme(axis: 'length' | 'width'): string {
  return [
  'Присадка для ЧПУ — по одной детали на файл',
  '',
  'index.csv     — какой файл какой детали, сколько отверстий, нужен ли переворот.',
  '<NN>-<id>.csv — программа одной детали: по строке на отверстие.',
  '',
  'Файл назван идентификатором детали (side-left, а не «боковина»): у двух',
  'боковин одно имя, но присадка может отличаться. Тот же идентификатор',
  'напечатан на бирке детали и стоит в имени её DXF.',
  '',
  'Координаты — на РЕЗАНОЙ детали (без кромки), от левого нижнего угла',
  'указанной стороны. Станок видит именно такую деталь.',
  axis === 'length'
    ? 'Наружная сторона: переверните деталь вокруг оси ДЛИНЫ (X); Y отражён.'
    : 'Наружная сторона: переверните деталь вокруг оси ШИРИНЫ (Y); X отражён.',
  '',
  'Столбец «Сквозное» = да — отверстие проходит деталь насквозь: кладите',
  'подкладку, иначе выход рвёт пласть.',
  '',
  'Пазы и вырезы (мойка, розетка, труба) в этих файлах НЕ передаются:',
  'это работа фрезы и она задаётся контуром. Берите их из DXF деталей —',
  'в index.csv отмечено, у каких деталей они есть.',
  '',
  'Кодировка — UTF-8 с BOM, разделитель — точка с запятой, конец строки —',
  'CRLF. Точка с запятой выбрана намеренно: дробные размеры пишутся через',
  'точку, и запятая-разделитель спорила бы с ними в Excel.',
].join('\r\n') + '\r\n'
}
