/**
 * Кесу картасының РЕЗ ТІЗБЕГІ (§5-тің жалғасы).
 *
 * `nesting.ts` детальді параққа ОРНАЛАСТЫРАДЫ, бірақ станоктың нақты жұмысы
 * туралы ештеңе айтпайды. Цехқа керегі — сол жұмыстың өзі: неше рез, қанша
 * метр, парақты неше рет бұру керек, парақтың қанша пайызы детальға кетті.
 * Осы файл орналасқан детальдардан РЕЗДЕРДІ шығарады.
 *
 * НЕГЕ ҚАЙТА ШЫҒАРАМЫЗ, орналастыру кезінде жазып алмаймыз? Орналастыру
 * алгоритмі бос орынды өз ыңғайына қарай бөледі; ол бөліністің реті станоктың
 * кесу ретімен сәйкес келуі МІНДЕТТІ ЕМЕС. Ал гильотин сызбасынан рездерді
 * әрқашан қайта табуға болады (тестердегі верификатор дәл солай жүреді).
 * Сондықтан бұл жердегі есеп орналастырудың ішкі құрылымына тәуелді емес:
 * алгоритм ауысса да, рез тізбегі дұрыс шығады.
 *
 * ЕСКЕРТУ. Мұндағы сан — станоктың жоспары, оның паспорты емес. Нақты цехта
 * бір рез бірнеше парақты қатар кесуі мүмкін (пачка), сонда метраж бірдей,
 * ал уақыт азаяды. Бұл жерде әр парақ ЖЕКЕ саналады.
 */

import { KERF } from './constants'
import { validateKerf } from './nesting'
import type { MaterialNesting, NestedPart, NestedSheet, NestingResult, SheetRect } from './nesting'

/**
 * Бір рез.
 *
 * `axis` — сызықтың бағыты: `'v'` тік сызық (тұрақты `x`), `'h'` көлденең
 * (тұрақты `y`). Станок үшін бұл екеуінің айырмасы — парақты бұру.
 */
export type CutLine = {
  axis: 'v' | 'h'
  /** Сызықтың координатасы: `'v'` үшін x, `'h'` үшін y. */
  at: number
  /** Сызықтың басы мен соңы екінші ось бойынша. */
  from: number
  to: number
  /**
   * `trim` — парақтың шетін алу (обрезка);
   * `split` — бір аймақты екі топқа бөлу;
   * `size` — жалғыз қалған детальді өлшеміне келтіру.
   */
  kind: 'trim' | 'split' | 'size'
  /** Орындалу реті, 1-ден. */
  order: number
}

export type CutStats = {
  cutCount: number
  /** Барлық рездің ұзындығы, мм. */
  cutLength: number
  /** Парақты бұру саны: тізбекте бағыт неше рет ауысады. */
  turns: number
  /** Детальдардың ауданы, мм². */
  partArea: number
  /** Парақтың ТОЛЫҚ ауданы (подрезкаға дейінгі), мм². */
  sheetArea: number
  /** Деловой отход — 100×100-ден үлкен қалдықтардың ауданы, мм². */
  offcutArea: number
  /**
   * КИМ — материалды пайдалану коэффициенті, %. Бөлгіш — парақтың ТОЛЫҚ
   * ауданы, себебі цех парақты толық сатып алады: подрезкаға кеткен жолақ
   * та ақшамен төленген.
   */
  kim: number
}

export type SheetCutPlan = {
  materialId: string
  /** Осы материал бойынша парақтың реті (`NestedSheet.index`). */
  index: number
  cuts: CutLine[]
  stats: CutStats
}

export type MaterialCutPlan = {
  materialId: string
  materialName: string
  sheets: SheetCutPlan[]
  stats: CutStats
}

export type CutPlan = {
  byMaterial: MaterialCutPlan[]
  stats: CutStats
}

export type CutPlanOptions = {
  /**
   * Пропил. Орналастыру қандай пропилмен жасалса, СОЛ сан берілуі керек:
   * рездер детальдардың арасындағы саңылаудан табылады.
   */
  kerf?: number
}

const areaOf = (r: SheetRect): number => r.width * r.height

/** Тізбектегі бағыт ауысулары: парақты станокта неше рет бұру керек. */
function countTurns(cuts: CutLine[]): number {
  let turns = 0
  for (let i = 1; i < cuts.length; i += 1) {
    if (cuts[i]!.axis !== cuts[i - 1]!.axis) turns += 1
  }
  return turns
}

function emptyStats(): CutStats {
  return { cutCount: 0, cutLength: 0, turns: 0, partArea: 0, sheetArea: 0, offcutArea: 0, kim: 0 }
}

/**
 * Аймақты екіге бөлетін ЕҢ ЖАҚЫН толық рез. Гильотин ережесі: сызық бірде-бір
 * детальді қақ жармауы керек, әрі екі жағында да деталь қалуы тиіс.
 *
 * Ең кішісін (сол жақтағысын / төмендегісін) аламыз: станок жолақты шетінен
 * бастап кесіп алады.
 */
function findCut(parts: NestedPart[], axis: 'v' | 'h'): number | null {
  const start = (p: NestedPart) => (axis === 'v' ? p.x : p.y)
  const end = (p: NestedPart) => (axis === 'v' ? p.x + p.width : p.y + p.height)

  const candidates = [...new Set(parts.map(end))].sort((a, b) => a - b)
  for (const at of candidates) {
    const before = parts.filter((p) => end(p) <= at)
    const after = parts.filter((p) => start(p) >= at)
    if (before.length > 0 && after.length > 0 && before.length + after.length === parts.length) {
      return at
    }
  }
  return null
}

/**
 * Аймақты рекурсивті бөлу.
 *
 * Бағытты таңдау ережесі: МҮМКІНДІГІНШЕ АЛДЫҢҒЫ РЕЗДІҢ бағытымен жүреміз.
 * Бұл — станоктың нақты әдеті: парақты бұру уақыт алады, сондықтан бір
 * бағыттағы рездер топтап орындалады. Сол бағытта толық рез табылмаса ғана
 * екіншісіне ауысамыз.
 */
function splitRegion(
  region: SheetRect,
  parts: NestedPart[],
  kerf: number,
  parentAxis: 'v' | 'h',
  out: CutLine[],
): void {
  if (parts.length === 0) return

  if (parts.length === 1) {
    const p = parts[0]!
    // Әр резден кейін бөлшек жатқан нақты аймақ тарылып отырады.
    // Алдыңғы бағытпен бастау артық бұрылысты болдырмайды.
    const remaining = { ...region }
    for (const axis of parentAxis === 'v' ? ['v', 'h'] as const : ['h', 'v'] as const) {
      if (axis === 'v' && remaining.x + remaining.width > p.x + p.width) {
        const at = p.x + p.width
        out.push({ axis, at, from: remaining.y, to: remaining.y + remaining.height, kind: 'size', order: 0 })
        remaining.width = at - remaining.x
      }
      if (axis === 'h' && remaining.y + remaining.height > p.y + p.height) {
        const at = p.y + p.height
        out.push({ axis, at, from: remaining.x, to: remaining.x + remaining.width, kind: 'size', order: 0 })
        remaining.height = at - remaining.y
      }
    }
    return
  }

  const sameFirst: ('v' | 'h')[] = parentAxis === 'v' ? ['v', 'h'] : ['h', 'v']
  for (const axis of sameFirst) {
    const at = findCut(parts, axis)
    if (at === null) continue

    if (axis === 'v') {
      out.push({ axis, at, from: region.y, to: region.y + region.height, kind: 'split', order: 0 })
      const before = parts.filter((p) => p.x + p.width <= at)
      const after = parts.filter((p) => p.x >= at)
      const afterX = Math.min(at + kerf, ...after.map((p) => p.x))
      splitRegion({ ...region, width: at - region.x }, before, kerf, axis, out)
      splitRegion(
        { x: afterX, y: region.y, width: region.x + region.width - afterX, height: region.height },
        after, kerf, axis, out,
      )
    } else {
      out.push({ axis, at, from: region.x, to: region.x + region.width, kind: 'split', order: 0 })
      const below = parts.filter((p) => p.y + p.height <= at)
      const above = parts.filter((p) => p.y >= at)
      const aboveY = Math.min(at + kerf, ...above.map((p) => p.y))
      splitRegion({ ...region, height: at - region.y }, below, kerf, axis, out)
      splitRegion(
        { x: region.x, y: aboveY, width: region.width, height: region.y + region.height - aboveY },
        above, kerf, axis, out,
      )
    }
    return
  }

  // Мұнда келу — сызба гильотиндік емес дегенді білдіреді. `nestPanels` мұндай
  // сызба бермейді (тесті бар), сондықтан үнсіз қалдырмай, білдіріп кетеміз.
  throw new Error('раскрой гильотиндік емес: аймақты бөлетін толық рез табылмады')
}

/** Парақтың шетін алу. Пайдалы аймақ парақтан кіші болса, әр шеті — бір рез. */
function trimCuts(sheet: NestedSheet): CutLine[] {
  const u = sheet.usable
  const cuts: CutLine[] = []
  const remaining: SheetRect = { x: 0, y: 0, width: sheet.sheetWidth, height: sheet.sheetHeight }
  // Алдымен екі тік, сосын екі көлденең: осылай бұрылыс біреу ғана болады.
  if (u.x > 0) {
    cuts.push({ axis: 'v', at: u.x, from: remaining.y, to: remaining.y + remaining.height, kind: 'trim', order: 0 })
    remaining.width -= u.x
    remaining.x = u.x
  }
  if (u.x + u.width < sheet.sheetWidth) {
    cuts.push({ axis: 'v', at: u.x + u.width, from: remaining.y, to: remaining.y + remaining.height, kind: 'trim', order: 0 })
    remaining.width = u.width
  }
  if (u.y > 0) {
    cuts.push({ axis: 'h', at: u.y, from: remaining.x, to: remaining.x + remaining.width, kind: 'trim', order: 0 })
    remaining.height -= u.y
    remaining.y = u.y
  }
  if (u.y + u.height < sheet.sheetHeight) {
    cuts.push({ axis: 'h', at: u.y + u.height, from: remaining.x, to: remaining.x + remaining.width, kind: 'trim', order: 0 })
    remaining.height = u.height
  }
  return cuts
}

/** Бір парақтың рез тізбегі мен сандары. */
export function sheetCutPlan(sheet: NestedSheet, options: CutPlanOptions = {}): SheetCutPlan {
  const kerf = options.kerf ?? KERF
  validateKerf(kerf)
  const cuts: CutLine[] = trimCuts(sheet)
  // Соңғы обрезка көлденең болды — ішкі бөлікті сол бағыттан бастаймыз.
  const lastAxis = cuts.length > 0 ? cuts[cuts.length - 1]!.axis : 'v'
  splitRegion({ ...sheet.usable }, sheet.parts, kerf, lastAxis, cuts)
  cuts.forEach((c, i) => { c.order = i + 1 })

  const partArea = sheet.parts.reduce((sum, p) => sum + p.width * p.height, 0)
  const sheetArea = sheet.sheetWidth * sheet.sheetHeight
  const offcutArea = sheet.offcuts.reduce((sum, o) => sum + areaOf(o), 0)

  return {
    materialId: sheet.materialId,
    index: sheet.index,
    cuts,
    stats: {
      cutCount: cuts.length,
      cutLength: cuts.reduce((sum, c) => sum + (c.to - c.from), 0),
      turns: countTurns(cuts),
      partArea,
      sheetArea,
      offcutArea,
      kim: sheetArea === 0 ? 0 : (partArea / sheetArea) * 100,
    },
  }
}

function sumStats(list: CutStats[]): CutStats {
  const total = list.reduce((acc, s) => ({
    cutCount: acc.cutCount + s.cutCount,
    cutLength: acc.cutLength + s.cutLength,
    turns: acc.turns + s.turns,
    partArea: acc.partArea + s.partArea,
    sheetArea: acc.sheetArea + s.sheetArea,
    offcutArea: acc.offcutArea + s.offcutArea,
    kim: 0,
  }), emptyStats())
  total.kim = total.sheetArea === 0 ? 0 : (total.partArea / total.sheetArea) * 100
  return total
}

function materialCutPlan(m: MaterialNesting, options: CutPlanOptions): MaterialCutPlan {
  const sheets = m.sheets.map((s) => sheetCutPlan(s, options))
  return {
    materialId: m.materialId,
    materialName: m.materialName,
    sheets,
    stats: sumStats(sheets.map((s) => s.stats)),
  }
}

/** Бүкіл раскройдың рез жоспары: материал бойынша және жалпы. */
export function cutPlan(nesting: NestingResult, options: CutPlanOptions = {}): CutPlan {
  const effectiveOptions = { kerf: options.kerf ?? nesting.kerf ?? KERF }
  const byMaterial = nesting.byMaterial.map((m) => materialCutPlan(m, effectiveOptions))
  return { byMaterial, stats: sumStats(byMaterial.map((m) => m.stats)) }
}

/**
 * Парақтағы қалдықтар: іске жарайтыны (деловой отход) мен қоқысы.
 * `NestedSheet.offcuts` тек біріншісін ұстайды — бұл жерде екеуі де саналады,
 * себебі /cut бетінде цех «қанша кетті» дегенді толық көруі керек.
 */
export function offcutSummary(sheet: NestedSheet): {
  useful: number
  usefulArea: number
  scrapArea: number
} {
  const usefulArea = sheet.offcuts.reduce((sum, o) => sum + areaOf(o), 0)
  const partArea = sheet.parts.reduce((sum, p) => sum + p.width * p.height, 0)
  return {
    useful: sheet.offcuts.length,
    usefulArea,
    scrapArea: Math.max(0, sheet.sheetWidth * sheet.sheetHeight - partArea - usefulArea),
  }
}
