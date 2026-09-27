/**
 * ОЙМА (вырез) — панельдің ішінен алынатын тесік.
 *
 * Не үшін: раковинаның ұясы, розетканың орны, құбырдың айналып өтуі,
 * желдеткіштің тесігі. Бұлардың бірде-бірі параметрлі модельден шықпайды —
 * олар нақты пәтердің шындығы, ал ол шындықты цех қана біледі.
 *
 * ҚАЙДА САҚТАЛАДЫ. Панель әрқашан конфигтен қайта есептеледі (§7), сондықтан
 * ойма панельге емес, КОНФИГКЕ жазылады (`cabinet.panelCutouts`), панельдің
 * id-і бойынша — присадканың қолмен түзетілуімен дәл бір тәсіл.
 *
 * КООРДИНАТА. Өлшем таңдалған БҰРЫШТАН есептеледі: цех сызбаны солай оқиды
 * («сол жоғарғы бұрыштан 100 мм оңға, 60 мм төмен»). Ішінде ол панельдің
 * локал өстеріне (x — ұзындық, y — ен) аударылады да, DXF пен 3D сол
 * координатамен жүреді.
 *
 * ⚠ РАСКРОЙҒА ӘСЕР ЕТПЕЙДІ. Ойма детальдің СЫРТҚЫ өлшемін өзгертпейді:
 * парақтан бәрібір тікбұрыш кесіледі, ойма содан кейін фрезамен алынады.
 * Сондықтан `nestPanels` оны көрмейді — бұл әдейі.
 */

import { ConfigValidationError } from './errors'
import { subtractedThickness } from './edges'
import { materialWidthRangeAt } from './bevelBounds'
import type { ConstructionSettings, EdgeBand, Panel, PanelCorners } from './types'

/** Өлшем қай бұрыштан саналады. */
export type CutoutCorner = 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight'

export type Cutout = {
  id: string
  /** Не үшін екені — деталировкадағы ескертпеге түседі. */
  label?: string | undefined
  corner: CutoutCorner
  /** Таңдалған бұрыштан ойманың ЖАҚЫН бұрышына дейін, мм. */
  x: number
  y: number
} & (
  | { shape: 'rect'; width: number; height: number; radius?: number | undefined }
  /** Дөңгелекте `x`/`y` — ОРТАСЫНА дейінгі қашықтық. */
  | { shape: 'circle'; diameter: number }
)

/** Панель id-і → оймалары. */
export type PanelCutouts = Record<string, Cutout[]>

/**
 * Ойманың панельдің ЛОКАЛ өстеріндегі шекарасы.
 * Локал x — ұзындық бойымен, y — ен бойымен (types.ts қара).
 */
export type CutoutBounds = { x: number; y: number; width: number; height: number }

export type CutoutPoint = { x: number; y: number }
export type RoundedCutoutPath = {
  lines: { from: CutoutPoint; to: CutoutPoint }[]
  arcs: { center: CutoutPoint; radius: number; startDeg: number; endDeg: number }[]
}

/** 3D және DXF қолданатын R-бұрышты ойықтың бірдей төрт түзуі мен доғасы. */
export function roundedCutoutPath(bounds: CutoutBounds, radius: number): RoundedCutoutPath {
  const { x, y, width: w, height: h } = bounds
  const r = radius
  const lines = [
    { from: { x: x + r, y }, to: { x: x + w - r, y } },
    { from: { x: x + w, y: y + r }, to: { x: x + w, y: y + h - r } },
    { from: { x: x + w - r, y: y + h }, to: { x: x + r, y: y + h } },
    { from: { x, y: y + h - r }, to: { x, y: y + r } },
  ].filter(({ from, to }) => from.x !== to.x || from.y !== to.y)
  const arcs = [
    { center: { x: x + r, y: y + r }, radius: r, startDeg: 180, endDeg: 270 },
    { center: { x: x + w - r, y: y + r }, radius: r, startDeg: 270, endDeg: 360 },
    { center: { x: x + w - r, y: y + h - r }, radius: r, startDeg: 0, endDeg: 90 },
    { center: { x: x + r, y: y + h - r }, radius: r, startDeg: 90, endDeg: 180 },
  ]
  return { lines, arcs }
}

/** Дайын бұрыштан рез бұрышына жылжу; присадка мен DXF осы datum-ды қолданады. */
export function cutoutCutOrigin(panel: Panel, bands: Map<string, EdgeBand>, settings: ConstructionSettings): { x: number; y: number } {
  return {
    x: subtractedThickness(panel.edges.W1, bands, settings),
    y: subtractedThickness(panel.edges.L1, bands, settings),
  }
}

export function cutoutBounds(cutout: Cutout, panelLength: number, panelWidth: number): CutoutBounds {
  const size = cutout.shape === 'rect'
    ? { width: cutout.width, height: cutout.height }
    : { width: cutout.diameter, height: cutout.diameter }

  // Дөңгелекте координата ОРТАСЫНА берілген — сол-төменгі бұрышқа келтіреміз.
  const fromCornerX = cutout.shape === 'circle' ? cutout.x - size.width / 2 : cutout.x
  const fromCornerY = cutout.shape === 'circle' ? cutout.y - size.height / 2 : cutout.y

  const left = cutout.corner === 'bottomLeft' || cutout.corner === 'topLeft'
    ? fromCornerX
    : panelLength - fromCornerX - size.width
  const bottom = cutout.corner === 'bottomLeft' || cutout.corner === 'bottomRight'
    ? fromCornerY
    : panelWidth - fromCornerY - size.height

  return { x: left, y: bottom, width: size.width, height: size.height }
}

/**
 * Тексеру. Ойма панельдің ІШІНДЕ толық жатуы керек: жиекке шығып кетсе, ол
 * ойма емес, детальдің пішіні өзгереді — ал оны раскрой да, кромка да басқаша
 * есептеуі керек еді. Сондықтан бұл — ҚАТЕ, үнсіз қиып тастау емес.
 */
export function validateCutout(
  cutout: Cutout,
  panel: Panel,
  field: string,
  bands: Map<string, EdgeBand>,
  settings: ConstructionSettings,
): void {
  const ints: [string, number][] = cutout.shape === 'rect'
    ? [['x', cutout.x], ['y', cutout.y], ['width', cutout.width], ['height', cutout.height]]
    : [['x', cutout.x], ['y', cutout.y], ['diameter', cutout.diameter]]

  for (const [name, value] of ints) {
    if (!Number.isInteger(value)) {
      throw new ConfigValidationError(`${field}.${name}`, `${value}`, 'бүтін сан, мм')
    }
  }
  const size = cutout.shape === 'rect'
    ? { width: cutout.width, height: cutout.height }
    : { width: cutout.diameter, height: cutout.diameter }
  if (size.width <= 0 || size.height <= 0) {
    throw new ConfigValidationError(`${field}`, `${size.width}×${size.height}`, 'оң сан, мм')
  }
  if (cutout.shape === 'rect' && cutout.radius !== undefined) {
    const max = Math.min(cutout.width, cutout.height) / 2
    if (!Number.isInteger(cutout.radius) || cutout.radius < 0 || cutout.radius > max) {
      throw new ConfigValidationError(`${field}.radius`, `${cutout.radius}`, `0..${Math.floor(max)} мм`)
    }
  }

  const bounds = cutoutBounds(cutout, panel.finishedLength, panel.finishedWidth)
  if (
    bounds.x < 0 || bounds.y < 0
    || bounds.x + bounds.width > panel.finishedLength
    || bounds.y + bounds.height > panel.finishedWidth
  ) {
    throw new ConfigValidationError(
      field,
      `вырез выходит за деталь ${panel.finishedLength}×${panel.finishedWidth}`,
      'вырез должен целиком лежать внутри детали',
    )
  }
  const origin = cutoutCutOrigin(panel, bands, settings)
  const x0 = bounds.x - origin.x
  const y0 = bounds.y - origin.y
  const x1 = x0 + bounds.width
  const y1 = y0 + bounds.height
  const withinBlank = x0 >= 0 && y0 >= 0 && x1 <= panel.cutLength && y1 <= panel.cutWidth
  const withinBevel = [x0, x1].every((x) => {
    const [low, high] = materialWidthRangeAt(panel, x)
    return y0 >= low && y1 <= high
  })
  if (!withinBlank || !withinBevel) {
    throw new ConfigValidationError(field, 'ойма рез контурынан шығып кетті',
      'ойма түгел рез детальдің материалында болуы керек')
  }
}

/**
 * Оймаларды панельдерге жабу. Панельдер ОРНЫНДА өзгертіледі — бұл функция
 * `generateCabinet`-тің ішінде, панельдер әлі ешкімге берілмей тұрып
 * шақырылады.
 */
export function applyCutouts(
  panels: Panel[], cutouts: PanelCutouts | undefined,
  bands: Map<string, EdgeBand>, settings: ConstructionSettings,
): void {
  if (!cutouts) return
  for (const panel of panels) {
    const list = cutouts[panel.id]
    if (!list || list.length === 0) continue

    const seen = new Set<string>()
    list.forEach((cutout, i) => {
      const field = `panelCutouts[${panel.id}][${i}]`
      if (seen.has(cutout.id)) {
        throw new ConfigValidationError(`${field}.id`, `id қайталанды: "${cutout.id}"`, 'бірегей id')
      }
      seen.add(cutout.id)
      validateCutout(cutout, panel, field, bands, settings)
    })

    // Көшірме: конфигтегі объект панельге СІЛТЕМЕМЕН кетпеуі керек.
    panel.cutouts = list.map((c) => ({ ...c }))
    const names = list.map((c) => c.label).filter(Boolean)
    const note = names.length > 0 ? `Вырезы: ${names.join(', ')}` : `Вырезов: ${list.length}`
    panel.note = panel.note ? `${panel.note}. ${note}` : note
  }
}

/** Жобадағы оймалардың саны — UI мен есептер үшін. */
export function cutoutCount(cutouts: PanelCutouts | undefined): number {
  if (!cutouts) return 0
  return Object.values(cutouts).reduce((sum, list) => sum + list.length, 0)
}

/**
 * Ойманың ПЕРИМЕТРІ, мм — фрезаның жолы.
 *
 * Цехқа бұл ақша: фреза метрмен есептеледі. qdesign ойманы тек сызады да,
 * құнына қоспайды — бізде ол сан бар.
 */
export function cutoutPerimeter(cutout: Cutout): number {
  if (cutout.shape === 'circle') return Math.PI * cutout.diameter
  const r = cutout.radius ?? 0
  // Дөңгелектелген бұрыш: түзу бөліктер қысқарады, орнына төрттен бір шеңбер.
  return 2 * (cutout.width + cutout.height) - 8 * r + 2 * Math.PI * r
}

/** Панельдегі бүкіл ойманың фреза жолы, метр. */
export function millingMetres(panels: Panel[]): number {
  let mm = 0
  for (const panel of panels) {
    for (const cutout of panel.cutouts) mm += cutoutPerimeter(cutout)
  }
  return mm / 1000
}

/**
 * ДАЙЫН ОЙМАЛАР. Сандар нақты бұйымдардан алынған, ойдан емес:
 *   • розетка — Ø68 мм (еуростандарт подрозетник);
 *   • құбыр — Ø60 мм (жиі кездесетін канализация шығысы);
 *   • желдеткіш торы — 60 × 204 мм (стандарт жиһаз торы);
 *   • раковина мен плита — өлшемі бұйымға қарай, сондықтан ӘДЕЙІ БОС
 *     қалдырылған: оларды өндіруші паспортынан алады.
 */
export type CutoutPreset = {
  id: string
  name: string
  shape: Cutout['shape']
  width?: number
  height?: number
  diameter?: number
  radius?: number
}

export const CUTOUT_PRESETS: CutoutPreset[] = [
  { id: 'socket', name: 'Розетка Ø68', shape: 'circle', diameter: 68 },
  { id: 'pipe', name: 'Труба Ø60', shape: 'circle', diameter: 60 },
  { id: 'cable', name: 'Кабель-канал Ø80', shape: 'circle', diameter: 80 },
  { id: 'vent', name: 'Вентрешётка 204 × 60', shape: 'rect', width: 204, height: 60, radius: 5 },
  { id: 'plinth-notch', name: 'Вырез под плинтус 100 × 20', shape: 'rect', width: 100, height: 20 },
  { id: 'free', name: 'Свой вырез', shape: 'rect', width: 100, height: 60 },
]

export function findCutoutPreset(id: string): CutoutPreset | undefined {
  return CUTOUT_PRESETS.find((p) => p.id === id)
}

/**
 * ЕСКЕРТУЛЕР (қате ЕМЕС).
 *
 * Ойма жиекке тым жақын болса, деталь сол жерден сынғыш болады; екі ойма
 * қабаттасса, цех қайсысын кесерін білмейді. Бұларды ҚАТЕ қылмаймыз — цех
 * әдейі солай жасауы мүмкін (мыс. жиектегі ойық). Бірақ үнсіз де қалдырмаймыз.
 */
export type CutoutWarning = { cutoutId: string; message: string }

/** Жиектен осыдан жақын ойма ескертіледі. Бұл — САУ САНА шегі, цех ережесі емес. */
export const CUTOUT_EDGE_WARN = 20

export function cutoutWarnings(panel: Panel): CutoutWarning[] {
  const out: CutoutWarning[] = []
  const boxes = panel.cutouts.map(
    (c) => ({ c, b: cutoutBounds(c, panel.finishedLength, panel.finishedWidth) }),
  )

  for (const { c, b } of boxes) {
    const gaps = [b.x, b.y, panel.finishedLength - b.x - b.width, panel.finishedWidth - b.y - b.height]
    const nearest = Math.min(...gaps)
    if (nearest < CUTOUT_EDGE_WARN) {
      out.push({
        cutoutId: c.id,
        message: `до края ${Math.round(nearest)} мм — деталь может выломаться при фрезеровке`,
      })
    }
  }

  for (let i = 0; i < boxes.length; i += 1) {
    for (let k = i + 1; k < boxes.length; k += 1) {
      const a = boxes[i]!.b
      const b = boxes[k]!.b
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width
        && a.y < b.y + b.height && b.y < a.y + a.height
      if (overlap) {
        out.push({
          cutoutId: boxes[k]!.c.id,
          message: `пересекается с вырезом «${boxes[i]!.c.label ?? boxes[i]!.c.id}»`,
        })
      }
    }
  }

  return out
}


/**
 * Жеке детальдің текстура бағыты мен бұрыштарының дөңгелектенуі.
 *
 * Екеуі де оймамен бір жерде тұр: үшеуі де БІР ДЕТАЛЬДІҢ өз қасиеті, әрі
 * үшеуі де конфигте панель id-і бойынша сақталады.
 *
 * ⚠ Текстура РАСКРОЙҒА әсер етеді: текстуралы материалда деталь бұрылмайды,
 * сондықтан бағытты өзгерту парақтағы орналасуды да өзгертеді. Ал бұрыштың
 * радиусы раскройды өзгертпейді — парақтан бәрібір тікбұрыш кесіледі.
 */
export function applyPanelOverrides(
  panels: Panel[],
  grain: Record<string, 'length' | 'width'> | undefined,
  corners: Record<string, PanelCorners> | undefined,
): void {
  for (const panel of panels) {
    const direction = grain?.[panel.id]
    if (direction) panel.grainAlongLength = direction === 'length'

    const radii = corners?.[panel.id]
    if (!radii) continue

    // Радиус детальдің жартысынан аспауы керек: одан үлкені — бұрыш емес,
    // басқа пішін. Оны үнсіз қиып тастамай, қате етіп айтамыз.
    const max = Math.min(panel.finishedLength, panel.finishedWidth) / 2
    for (const [name, value] of Object.entries(radii)) {
      if (!Number.isInteger(value) || value < 0 || value > max) {
        throw new ConfigValidationError(
          `panelCorners[${panel.id}].${name}`,
          `${value} мм`,
          `0..${Math.floor(max)} мм`,
        )
      }
    }
    if (Object.values(radii).some((r) => r > 0)) {
      panel.corners = { ...radii }
      const list = Object.values(radii).filter((r) => r > 0)
      panel.note = [panel.note, `Скругление R${Math.max(...list)}`].filter(Boolean).join('. ')
    }
  }
}
