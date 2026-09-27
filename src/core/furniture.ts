/**
 * ЖИҺАЗ ГЕНЕРАТОРЫ — қабырға ұзындығынан толық жиынтық, тек кухня емес.
 *
 * qdesign «Этапты конструктор» бірнеше ТҮР шығарады: Шкаф, Ас үй, ТВ аймақ,
 * Комод. Ас үй бөлек, бай логикамен (`kitchen.ts`). Мұнда — қалған үшеуі,
 * бір ортақ ағынмен: қабырға ұзындығын стандарт модульге бөлу + қабырғаға
 * орналастыру (+ Г-бұрыш).
 *
 * ⚠ ЖАҢА ГЕОМЕТРИЯ ЖОҚ. Әр модуль — бұрыннан бар, тестелген шаблон, тек ені
 * (кейде биіктігі) өзгереді. Раскрой/присадка/смета бұрынғыша.
 */

import { generateKitchen, splitRun } from './kitchen'
import type { KitchenResult } from './kitchen'
import { findTemplate, templateToCabinet } from './templates'
import { ConfigValidationError } from './errors'
import type { CabinetConfig, Catalog, Placement } from './types'

export type FurnitureType = 'kitchen' | 'wardrobe' | 'tv' | 'chest' | 'office' | 'bedroom'

/** Қабырғаға сыйатын ең кіші дайын жиын: ТВ 500+800+500, жатын 1600 кереует, кабинет 800 үстел. */
export function furnitureMinWallLength(type: FurnitureType): number {
  switch (type) {
    case 'tv': return 1800
    case 'bedroom': return 1600
    case 'office': return 800
    default: return 600
  }
}

export type FurnitureOptions = {
  type: FurnitureType
  layout: 'straight' | 'corner'
  lengthA: number
  lengthB?: number | undefined
  /** Материал (барлық модульге) */
  materials?: { carcassId?: string | undefined; frontId?: string | undefined } | undefined
  /** Ас үйге ғана: мойка/техника/үстіңгі қатар (kitchen.ts қабылдайды) */
  sink?: boolean | undefined
  upper?: boolean | undefined
  appliances?: boolean | undefined
}

export type FurnitureResult = KitchenResult

const ROOM_MARGIN = 400
const MODULE_MIN = 300

type Built = { cabinet: CabinetConfig; wall: 'north' | 'east'; offset: number; elevation?: number }

function applyMaterials(cabinet: CabinetConfig, m: FurnitureOptions['materials']): CabinetConfig {
  if (!m) return cabinet
  return {
    ...cabinet,
    carcassMaterialId: m.carcassId ?? cabinet.carcassMaterialId,
    frontMaterialId: m.frontId ?? cabinet.frontMaterialId,
  }
}

/**
 * Бір типтегі модульдерді қабырға(лар)ға тізу.
 *
 * Түзу: солтүстік бойымен offset 0-ден. Бұрыш: перпендикуляр қатар шығыс
 * қабырғада, көршісінің ТЕРЕҢДІГІНЕН басталады (offset = depth − q − width) —
 * дәл `kitchen.ts`-тегі бұрыш ережесі, сонда бұрыш кубында соқтығыспайды.
 */
function layoutModules(
  widthsA: number[], widthsB: number[], depth: number, roomDepth: number,
  make: (width: number, i: number, wall: 'north' | 'east') => CabinetConfig,
): Built[] {
  const out: Built[] = []
  let cursor = 0
  widthsA.forEach((width, i) => {
    out.push({ cabinet: make(width, i, 'north'), wall: 'north', offset: cursor })
    cursor += width
  })
  let q = widthsB.length > 0 ? depth : 0
  widthsB.forEach((width, i) => {
    out.push({ cabinet: make(width, i, 'east'), wall: 'east', offset: roomDepth - q - width })
    q += width
  })
  return out
}


/**
 * Шкаф / Комод: біркелкі модуль қатары (толық биік не аласа), + Г-бұрыш.
 */
function generateRow(
  opts: FurnitureOptions, catalog: Catalog,
  cfg: { templateId: string; height: number; depth: number; preferred: number; min: number; max: number },
): FurnitureResult {
  const tpl = findTemplate(cfg.templateId)!
  const corner = opts.layout === 'corner' && (opts.lengthB ?? 0) >= MODULE_MIN
  const widthsA = splitRun(opts.lengthA, { preferred: cfg.preferred, min: cfg.min, max: cfg.max })
  const widthsB = corner ? splitRun(opts.lengthB!, { preferred: cfg.preferred, min: cfg.min, max: cfg.max }) : []
  const totalA = widthsA.reduce((s, w) => s + w, 0)
  const totalB = widthsB.reduce((s, w) => s + w, 0)

  const roomDepth = Math.max(3000, (corner ? cfg.depth + totalB : 0) + ROOM_MARGIN)
  let counter = 0
  const make = (width: number, _i: number, _wall: 'north' | 'east'): CabinetConfig => {
    counter += 1
    const cab = { ...templateToCabinet(tpl, catalog, { width, height: cfg.height, depth: cfg.depth }), id: `${opts.type}-${counter}` }
    return applyMaterials(cab, opts.materials)
  }
  const built = layoutModules(widthsA, widthsB, cfg.depth, roomDepth, make)
  return {
    cabinets: built.map((b) => b.cabinet),
    placements: built.map((b) => ({ cabinetId: b.cabinet.id, wall: b.wall, offset: b.offset })),
    room: {
      width: Math.max(3000, totalA + ROOM_MARGIN),
      depth: roomDepth,
      height: Math.max(2700, cfg.height + 200),
    },
  }
}

/**
 * ТВ аймақ: ортада аласа ТВ-тумба, шетте екі биік бағана, тумба үстінде
 * ілмелі шкаф. qdesign «ТВ аймақ»-тың құрылымы осындай.
 */
function generateTv(opts: FurnitureOptions, catalog: Catalog): FurnitureResult {
  const columnTpl = findTemplate('bookcase-2sec-1200')!
  const standTpl = findTemplate('tv-stand-1200')!
  const upperTpl = findTemplate('kitchen-wall-open-800')!
  const COL_W = 500, COL_H = 2000, COL_D = 300
  const STAND_H = 500, STAND_D = 400
  const UPPER_H = 500, UPPER_D = 250, UPPER_ELEV = 1100

  const length = opts.lengthA
  // Екі 500 мм бағана мен кемінде 800 мм ТВ-тумба осы қабырғаға сыйсын.
  if (length < 2 * COL_W + 800) {
    throw new ConfigValidationError('lengthA', `${length} мм`, `≥ ${2 * COL_W + 800} мм`)
  }
  const standWidth = Math.max(800, Math.min(2000, length - 2 * COL_W))
  let counter = 0
  const id = () => `tv-${(counter += 1)}`
  const cabinets: CabinetConfig[] = []
  const placements: Placement[] = []

  // Сол бағана
  const left = applyMaterials({ ...templateToCabinet(columnTpl, catalog, { width: COL_W, height: COL_H, depth: COL_D }), id: id() }, opts.materials)
  cabinets.push(left); placements.push({ cabinetId: left.id, wall: 'north', offset: 0 })
  // ТВ-тумба (аласа, ортада)
  const stand = applyMaterials({ ...templateToCabinet(standTpl, catalog, { width: standWidth, height: STAND_H, depth: STAND_D }), id: id() }, opts.materials)
  cabinets.push(stand); placements.push({ cabinetId: stand.id, wall: 'north', offset: COL_W })
  // Тумба үстіндегі ілмелі шкаф
  const upper = applyMaterials({ ...templateToCabinet(upperTpl, catalog, { width: standWidth, height: UPPER_H, depth: UPPER_D }), id: id() }, opts.materials)
  cabinets.push(upper); placements.push({ cabinetId: upper.id, wall: 'north', offset: COL_W, elevation: UPPER_ELEV })
  // Оң бағана
  const right = applyMaterials({ ...templateToCabinet(columnTpl, catalog, { width: COL_W, height: COL_H, depth: COL_D }), id: id() }, opts.materials)
  cabinets.push(right); placements.push({ cabinetId: right.id, wall: 'north', offset: COL_W + standWidth })

  const totalW = 2 * COL_W + standWidth
  return {
    cabinets,
    placements,
    room: { width: Math.max(3000, totalW + ROOM_MARGIN), depth: 3000, height: 2700 },
  }
}

/** Кереует пен екі тумба — тек дайын өндірістік шаблондар. Артық қабырға бос қалады. */
function generateBedroom(opts: FurnitureOptions, catalog: Catalog): FurnitureResult {
  const bedTpl = findTemplate('bed-frame-1600')!
  const bedsideTpl = findTemplate('bedside-drawers-450')!
  if (!Number.isSafeInteger(opts.lengthA) || opts.lengthA < bedTpl.width) {
    throw new ConfigValidationError('lengthA', `${opts.lengthA} мм`, `бүтін мм ≥ ${bedTpl.width}`)
  }
  const sideWidth = Math.min(bedsideTpl.range.width.max, Math.floor((opts.lengthA - bedTpl.width) / 2))
  const withSides = sideWidth >= bedsideTpl.range.width.min
  const used = bedTpl.width + (withSides ? 2 * sideWidth : 0)
  const start = Math.floor((opts.lengthA - used) / 2)
  const cabinets: CabinetConfig[] = []
  const placements: Placement[] = []
  let cursor = start
  const add = (template: typeof bedTpl, width: number) => {
    const cabinet = applyMaterials({ ...templateToCabinet(template, catalog, { width }), id: `bedroom-${cabinets.length + 1}` }, opts.materials)
    cabinets.push(cabinet)
    placements.push({ cabinetId: cabinet.id, wall: 'north', offset: cursor })
    cursor += width
  }
  if (withSides) add(bedsideTpl, sideWidth)
  add(bedTpl, bedTpl.width)
  if (withSides) add(bedsideTpl, sideWidth)
  return {
    cabinets, placements,
    room: { width: Math.max(3000, opts.lengthA + ROOM_MARGIN), depth: Math.max(3000, bedTpl.depth + ROOM_MARGIN), height: 2700 },
  }
}

/** Түрге қарай генератор. Ас үй — бай логикамен бөлек (`kitchen.ts`). */
export function generateFurniture(opts: FurnitureOptions, catalog: Catalog): FurnitureResult {
  if (opts.type !== 'kitchen' && (!Number.isSafeInteger(opts.lengthA) || opts.lengthA < 600)) {
    throw new ConfigValidationError('lengthA', `${opts.lengthA} мм`, 'бүтін мм ≥ 600')
  }
  switch (opts.type) {
    case 'kitchen':
      return generateKitchen({
        layout: opts.layout, lengthA: opts.lengthA, lengthB: opts.lengthB,
        sink: opts.sink, upper: opts.upper, appliances: opts.appliances,
        materials: opts.materials,
      }, catalog)
    case 'wardrobe':
      return generateRow(opts, catalog, { templateId: 'wardrobe-2sec-1200', height: 2200, depth: 600, preferred: 900, min: 400, max: 1000 })
    case 'chest':
      return generateRow(opts, catalog, { templateId: 'chest-800', height: 850, depth: 450, preferred: 800, min: 400, max: 1200 })
    case 'tv':
      return generateTv(opts, catalog)
    case 'office':
      return generateRow(opts, catalog, { templateId: 'desk-1200', height: 750, depth: 600, preferred: 1200, min: 800, max: 1800 })
    case 'bedroom':
      return generateBedroom(opts, catalog)
  }
}
