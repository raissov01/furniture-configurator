/**
 * Раскрой (§5). ГИЛЬОТИНДІ ғана.
 *
 * Форматты-кескіш станок парақты шетінен шетіне дейін ТҮЗУ сызықпен кеседі.
 * Сондықтан жалпы мақсаттағы rectangle-packing жарамайды: ол цех кесе алмайтын
 * сызба береді. Мұндағы алгоритм — рекурсивті гильотиндік бөлу: әр деталь
 * бос тіктөртбұрышқа қойылады да, қалған орын дәл бір тік немесе көлденең
 * сызықпен екіге бөлінеді. Осылай шыққан сызбаның ӘР кесігі толық өтеді.
 *
 * Өлшемдер РЕЗ (`cutLength × cutWidth`) бойынша алынады — станок соны кеседі.
 *
 * Парақтың бағыты: X осі — `sheetWidth` (2800 жағы), текстура ОСЫ бойымен
 * жүреді. Сондықтан текстуралы материалда деталь бұрылмайды: оның бағыты
 * `grainAlongLength` арқылы қатаң анықталады.
 *
 * ОПТИМИЗАЦИЯ. Бір ғана эвристика ең жақсы нәтиже бермейді: бір жобада
 * «үлкеннен кішіге» ұтады, екіншісінде «аудан бойынша». Сондықтан бірнеше
 * стратегия ҚАТАР жүргізіліп, ең азы таңдалады (`optimization`). Ереже
 * өзгермейді — тек орналастыру реті мен бос орынды бөлу тәсілі ауысады,
 * гильотин шарты бәрінде де сақталады.
 */

import { KERF, MIN_USEFUL_OFFCUT } from './constants'
import { ConfigValidationError } from './errors'
import type { Catalog, Material, Panel } from './types'

/** Параққа қатысты тіктөртбұрыш, мм. (`export/drawing.ts` ішіндегі `Rect` — басқа нәрсе.) */
export type SheetRect = { x: number; y: number; width: number; height: number }

export type NestedPart = SheetRect & {
  panelId: string
  label: string
  /** Деталь 90°-қа бұрылып қойылды ма (текстурасыз материалда ғана болады) */
  rotated: boolean
}

export type NestedSheet = {
  /** Осы материал бойынша парақтың реті, 1-ден басталады */
  index: number
  materialId: string
  /** Парақтың толық өлшемі */
  sheetWidth: number
  sheetHeight: number
  /** Подрезкадан кейінгі пайдалы аймақ (сол-төменгі бұрышы `trimEdge`-те) */
  usable: SheetRect
  parts: NestedPart[]
  /** 100×100 мм-ден үлкен қалдықтар — деловой отход */
  offcuts: SheetRect[]
}

export type MaterialNesting = {
  materialId: string
  materialName: string
  sheets: NestedSheet[]
  /** Пайдалы аймақтың қанша пайызы қоқысқа кетті */
  wastePercent: number
  /** Деталь ауданы, мм² */
  partArea: number
  /** Пайдаланылған пайдалы аудан, мм² */
  usableArea: number
}

export type NestingResult = {
  byMaterial: MaterialNesting[]
  /** Барлық парақ саны */
  sheetCount: number
  /** Ешбір параққа сыймаған детальдар — әдетте өлшемі парақтан үлкен */
  unplaced: { panelId: string; label: string; reason: string }[]
}

/**
 * Іздеу тереңдігі.
 *
 * - `fast` — бір ғана эвристика. Габаритті сүйреп тұрғанда экран қатып қалмайды.
 * - `standard` — төрт эвристика. Әдепкі: есептің бәрі бірге де миллисекундпен өлшенеді.
 * - `deep` — он алтауы. Үлкен тапсырыста бір парақ үнемдеуі мүмкін, ал бір
 *   парақ ЛДСП — цехтың нақты ақшасы.
 */
export type OptimizationLevel = 'fast' | 'standard' | 'deep'

export type NestingOptions = {
  /**
   * Пропил (араның жолы), мм. Детальдар арасынан осынша материал жоғалады.
   * Станогы жіңішке аралы цех мұны азайта алады.
   */
  kerf?: number
  /**
   * Подрезка, мм. Берілсе, МАТЕРИАЛДАҒЫ `trimEdge` орнына қолданылады:
   * бір цех парақтың шетін 10 мм алады, екіншісі мүлде алмайды.
   */
  trimEdge?: number
  optimization?: OptimizationLevel
}

/** Детальдарды қай ретпен қою: бірінші қойылған деталь параққа орын таңдайды. */
type SortKey = 'longestSide' | 'area' | 'length' | 'width'

/**
 * Деталь қойылғаннан кейін қалған орынды қалай бөлу:
 * - `compact` — қысқа жағын бүтін қалдырады (жинақы блок);
 * - `strip` — ұзын жолақ қалдырады (ұзын детальдар үшін жақсы).
 */
type SplitRule = 'compact' | 'strip'

/** Бос орынды таңдау: қалдық АУДАНЫ ең аз, немесе ҚЫСҚА ЖАҒЫ ең тығыз. */
type FitRule = 'area' | 'shortSide'

type Strategy = { sort: SortKey; split: SplitRule; fit: FitRule }

/**
 * Стратегиялар. РЕТІ МАҢЫЗДЫ: біріншісі — тарихи әдепкі мінез, сондықтан
 * `fast` дәл сол нәтижені береді. Тең нәтижеде де осы рет шешеді, яғни
 * бір жоба әр ашқанда басқа сызба бермейді.
 */
const STRATEGIES: Strategy[] = (() => {
  const sorts: SortKey[] = ['longestSide', 'area', 'length', 'width']
  const out: Strategy[] = []
  for (const fit of ['area', 'shortSide'] as FitRule[]) {
    for (const split of ['compact', 'strip'] as SplitRule[]) {
      for (const sort of sorts) out.push({ sort, split, fit })
    }
  }
  return out
})()

const LEVEL_COUNT: Record<OptimizationLevel, number> = {
  fast: 1,
  standard: 4,
  deep: STRATEGIES.length,
}

function usableAreaOf(m: Material, trimOverride: number | undefined): SheetRect {
  const trim = trimOverride ?? m.trimEdge
  return {
    x: trim,
    y: trim,
    width: m.sheetWidth - trim * 2,
    height: m.sheetHeight - trim * 2,
  }
}

/**
 * Детальдің параққа қалай жататыны. Текстуралы материалда БІР ғана нұсқа
 * болады: мәтін бағыты сәйкес келмесе, ЛДСП-ның суреті бұзылады.
 */
function orientationsOf(panel: Panel, material: Material): { w: number; h: number; rotated: boolean }[] {
  const along = { w: panel.cutLength, h: panel.cutWidth, rotated: false }
  const across = { w: panel.cutWidth, h: panel.cutLength, rotated: true }
  if (!material.hasGrain) return [along, across]
  return [panel.grainAlongLength ? along : across]
}

type FreeRect = SheetRect

/**
 * Бос орынға деталь қойылғаннан кейін қалғанын ЕКІГЕ бөлу.
 *
 * Гильотиннің мәні осында: қалған орын дәл бір сызықпен бөлінеді, «Г» тәрізді
 * қалдық болмайды. Қай сызықпен бөлу — стратегияға байланысты: `compact`
 * қысқа жағын бүтін қалдырады, `strip` керісінше ұзын жолақ қалдырады.
 */
function splitFree(free: FreeRect, w: number, h: number, gap: number, rule: SplitRule): FreeRect[] {
  const restRight = free.width - w - gap
  const restTop = free.height - h - gap
  const out: FreeRect[] = []

  // Көлденең бөлу: оң жақта деталь биіктігіндегі жолақ, үстінде толық жолақ.
  const horizontal = () => {
    if (restRight > 0) out.push({ x: free.x + w + gap, y: free.y, width: restRight, height: h })
    if (restTop > 0) out.push({ x: free.x, y: free.y + h + gap, width: free.width, height: restTop })
  }
  // Тік бөлу: үстінде деталь еніндегі жолақ, оң жақта толық жолақ.
  const vertical = () => {
    if (restTop > 0) out.push({ x: free.x, y: free.y + h + gap, width: w, height: restTop })
    if (restRight > 0) out.push({ x: free.x + w + gap, y: free.y, width: restRight, height: free.height })
  }

  const compact = restRight < restTop
  if (rule === 'compact' ? compact : !compact) horizontal()
  else vertical()
  return out
}

/** Ең тығыз орын. `area` — қалдық ауданы ең аз, `shortSide` — қысқа жағы ең тығыз. */
function pickFree(
  frees: FreeRect[],
  panel: Panel,
  material: Material,
  fit: FitRule,
): { index: number; w: number; h: number; rotated: boolean } | null {
  let best: { index: number; w: number; h: number; rotated: boolean; score: number } | null = null
  for (let i = 0; i < frees.length; i += 1) {
    const f = frees[i]!
    for (const o of orientationsOf(panel, material)) {
      if (o.w > f.width || o.h > f.height) continue
      const score = fit === 'area'
        ? f.width * f.height - o.w * o.h
        : Math.min(f.width - o.w, f.height - o.h)
      if (!best || score < best.score) {
        best = { index: i, w: o.w, h: o.h, rotated: o.rotated, score }
      }
    }
  }
  if (!best) return null
  return { index: best.index, w: best.w, h: best.h, rotated: best.rotated }
}

function sortPanels(list: Panel[], key: SortKey): Panel[] {
  const area = (p: Panel) => p.cutLength * p.cutWidth
  const longest = (p: Panel) => Math.max(p.cutLength, p.cutWidth)
  return [...list].sort((a, b) => {
    switch (key) {
      // Үлкеннен кішіге: ұзын жағы бойынша. Кішіні алдымен қойсақ, парақ
      // ұсақ тесіктерге бөлініп кетеді де, үлкен деталь сыймай қалады.
      case 'longestSide': return longest(b) - longest(a) || area(b) - area(a)
      case 'area': return area(b) - area(a) || longest(b) - longest(a)
      case 'length': return b.cutLength - a.cutLength || b.cutWidth - a.cutWidth
      case 'width': return b.cutWidth - a.cutWidth || b.cutLength - a.cutLength
    }
  })
}

/** Бір стратегиямен бір рет орналастыру. */
function nestOnce(
  panels: Panel[],
  catalog: Catalog,
  gap: number,
  trimOverride: number | undefined,
  strategy: Strategy,
): NestingResult {
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))
  const groups = new Map<string, Panel[]>()
  for (const p of panels) {
    if (!materials.has(p.materialId)) {
      throw new ConfigValidationError(
        'materialId',
        `материал табылмады: "${p.materialId}"`,
        [...materials.keys()].join(' | '),
      )
    }
    const list = groups.get(p.materialId) ?? []
    list.push(p)
    groups.set(p.materialId, list)
  }

  const byMaterial: MaterialNesting[] = []
  const unplaced: NestingResult['unplaced'] = []

  for (const [materialId, list] of groups) {
    const material = materials.get(materialId)!
    const usable = usableAreaOf(material, trimOverride)

    const sorted = sortPanels(list, strategy.sort)

    const sheets: { parts: NestedPart[]; frees: FreeRect[] }[] = []
    let partArea = 0

    for (const panel of sorted) {
      const fits = orientationsOf(panel, material).some(
        (o) => o.w <= usable.width && o.h <= usable.height,
      )
      if (!fits) {
        unplaced.push({
          panelId: panel.id,
          label: panel.label,
          reason: `${panel.cutLength}×${panel.cutWidth} не помещается на лист ${usable.width}×${usable.height}`,
        })
        continue
      }

      let placed = false
      for (const sheet of sheets) {
        const spot = pickFree(sheet.frees, panel, material, strategy.fit)
        if (!spot) continue
        const free = sheet.frees[spot.index]!
        sheet.parts.push({
          panelId: panel.id,
          label: panel.label,
          x: free.x,
          y: free.y,
          width: spot.w,
          height: spot.h,
          rotated: spot.rotated,
        })
        sheet.frees.splice(spot.index, 1, ...splitFree(free, spot.w, spot.h, gap, strategy.split))
        partArea += spot.w * spot.h
        placed = true
        break
      }
      if (placed) continue

      // Жаңа парақ ашамыз.
      const sheet = { parts: [] as NestedPart[], frees: [{ ...usable }] }
      const spot = pickFree(sheet.frees, panel, material, strategy.fit)!
      const free = sheet.frees[spot.index]!
      sheet.parts.push({
        panelId: panel.id,
        label: panel.label,
        x: free.x,
        y: free.y,
        width: spot.w,
        height: spot.h,
        rotated: spot.rotated,
      })
      sheet.frees.splice(spot.index, 1, ...splitFree(free, spot.w, spot.h, gap, strategy.split))
      partArea += spot.w * spot.h
      sheets.push(sheet)
    }

    const usableArea = sheets.length * usable.width * usable.height
    byMaterial.push({
      materialId,
      materialName: material.name,
      sheets: sheets.map((s, i) => ({
        index: i + 1,
        materialId,
        sheetWidth: material.sheetWidth,
        sheetHeight: material.sheetHeight,
        usable: { ...usable },
        parts: s.parts,
        offcuts: s.frees.filter((f) => f.width >= MIN_USEFUL_OFFCUT && f.height >= MIN_USEFUL_OFFCUT),
      })),
      partArea,
      usableArea,
      wastePercent: usableArea === 0 ? 0 : ((usableArea - partArea) / usableArea) * 100,
    })
  }

  byMaterial.sort((a, b) => a.materialName.localeCompare(b.materialName))
  return {
    byMaterial,
    sheetCount: byMaterial.reduce((sum, m) => sum + m.sheets.length, 0),
    unplaced,
  }
}

/**
 * Нәтижені салыстыру. Реті цехтың ақшасымен сәйкес: ең қымбаты — АРТЫҚ ПАРАҚ,
 * сосын қоқысқа кеткен аудан. Тең болса — стратегия реті шешеді (тұрақтылық).
 */
function scoreOf(result: NestingResult): [number, number, number] {
  const waste = result.byMaterial.reduce((sum, m) => sum + (m.usableArea - m.partArea), 0)
  return [result.unplaced.length, result.sheetCount, waste]
}

function better(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]!
  }
  return false
}

/**
 * Панельдерді параққа орналастыру. Материал мен ҚАЛЫҢДЫҚ бойынша топталады —
 * бір параққа әртүрлі материал ешқашан түспейді.
 */
export function nestPanels(
  panels: Panel[],
  catalog: Catalog,
  options: NestingOptions = {},
): NestingResult {
  const gap = options.kerf ?? KERF
  const trimOverride = options.trimEdge
  const level = options.optimization ?? 'standard'
  const count = LEVEL_COUNT[level]

  let best: NestingResult | null = null
  let bestScore: [number, number, number] | null = null
  for (let i = 0; i < count; i += 1) {
    const result = nestOnce(panels, catalog, gap, trimOverride, STRATEGIES[i]!)
    const score = scoreOf(result)
    if (!best || !bestScore || better(score, bestScore)) {
      best = result
      bestScore = score
    }
  }
  return best!
}
