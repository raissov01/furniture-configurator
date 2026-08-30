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

/** Бос орынды бөлгенде пайда болатын аралық: араның жолы. */
const gap = KERF

function usableAreaOf(m: Material): SheetRect {
  return {
    x: m.trimEdge,
    y: m.trimEdge,
    width: m.sheetWidth - m.trimEdge * 2,
    height: m.sheetHeight - m.trimEdge * 2,
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
 * қалдық болмайды. Қай сызықпен бөлу — қысқа жағын бүтін қалдыратынын
 * таңдаймыз: ұзын әрі жіңішке қалдықтан гөрі, бүтін блок пайдалырақ.
 */
function splitFree(free: FreeRect, w: number, h: number): FreeRect[] {
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

  if (restRight < restTop) horizontal()
  else vertical()
  return out
}

/** Ең тығыз орын: қалдық ауданы ең аз бос тіктөртбұрыш (best area fit). */
function pickFree(
  frees: FreeRect[],
  panel: Panel,
  material: Material,
): { index: number; w: number; h: number; rotated: boolean } | null {
  let best: { index: number; w: number; h: number; rotated: boolean; leftover: number } | null = null
  for (let i = 0; i < frees.length; i += 1) {
    const f = frees[i]!
    for (const o of orientationsOf(panel, material)) {
      if (o.w > f.width || o.h > f.height) continue
      const leftover = f.width * f.height - o.w * o.h
      if (!best || leftover < best.leftover) {
        best = { index: i, w: o.w, h: o.h, rotated: o.rotated, leftover }
      }
    }
  }
  if (!best) return null
  return { index: best.index, w: best.w, h: best.h, rotated: best.rotated }
}

/**
 * Панельдерді параққа орналастыру. Материал мен ҚАЛЫҢДЫҚ бойынша топталады —
 * бір параққа әртүрлі материал ешқашан түспейді.
 */
export function nestPanels(panels: Panel[], catalog: Catalog): NestingResult {
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
    const usable = usableAreaOf(material)

    // Үлкеннен кішіге: ұзын жағы бойынша. Кішіні алдымен қойсақ, парақ
    // ұсақ тесіктерге бөлініп кетеді де, үлкен деталь сыймай қалады.
    const sorted = [...list].sort(
      (a, b) =>
        Math.max(b.cutLength, b.cutWidth) - Math.max(a.cutLength, a.cutWidth) ||
        b.cutLength * b.cutWidth - a.cutLength * a.cutWidth,
    )

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
        const spot = pickFree(sheet.frees, panel, material)
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
        sheet.frees.splice(spot.index, 1, ...splitFree(free, spot.w, spot.h))
        partArea += spot.w * spot.h
        placed = true
        break
      }
      if (placed) continue

      // Жаңа парақ ашамыз.
      const sheet = { parts: [] as NestedPart[], frees: [{ ...usable }] }
      const spot = pickFree(sheet.frees, panel, material)!
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
      sheet.frees.splice(spot.index, 1, ...splitFree(free, spot.w, spot.h))
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
