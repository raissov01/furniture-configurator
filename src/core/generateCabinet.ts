/**
 * Конфигтен панель тізімін жасау. CLAUDE.md §3: бұл — жалғыз ақиқат көзі.
 * 3D те, деталировка да, раскрой да, баға да ОСЫ массивтен оқиды.
 *
 * Таза функция: React жоқ, three.js жоқ, күй (state) жоқ.
 */

import { mergeSettings } from './constants.js'
import { distributeMillimetres, gapFillOrder } from './distribute.js'
import { calculateCutDimensions, resolveEdges } from './edges.js'
import { ConfigValidationError } from './errors.js'
import { ORIENT_FACING, ORIENT_HORIZONTAL, ORIENT_SIDE, rotationFor } from './geometry.js'
import type {
  CabinetConfig, Catalog, Material,
  Orientation, Panel, PanelRole, SettingsOverride,
} from './types.js'

/** Ең кіші жарамды габарит — бұдан кішісі корпус болмайды. */
const MIN_DIMENSION = 100
/** Ең үлкен габарит: бір парақтан ұзын. Бөлу (A2) кейінгі кезеңде. */
const MAX_DIMENSION = 4000

export function generateCabinet(
  config: CabinetConfig,
  catalog: Catalog,
  projectSettings?: SettingsOverride,
): Panel[] {
  const settings = mergeSettings(projectSettings, config.settings)
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))
  const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))

  const carcass = requireMaterial(materials, config.carcassMaterialId, 'carcassMaterialId')
  const backMat = requireMaterial(materials, config.backMaterialId, 'backMaterialId')
  const frontMat = requireMaterial(materials, config.frontMaterialId, 'frontMaterialId')

  const { height: H, width: W, depth: D } = config
  validateDimension(H, 'cabinet.height')
  validateDimension(W, 'cabinet.width')
  validateDimension(D, 'cabinet.depth')

  /** Корпус материалының қалыңдығы. ЕШҚАШАН 16 деп қатырылмайды. */
  const t = carcass.thickness

  /**
   * Арт қабырғаға берілетін тереңдік:
   *   overlay — ХДФ корпустың АРТЫНА қағылады, жалпы габарит D болып шығады
   *   groove  — панельдер арт жиектен grooveInset-ке қысқарады
   */
  const backAllowance = config.back.mode === 'overlay' ? settings.backThickness : settings.grooveInset

  if (config.back.mode === 'overlay' && backMat.thickness !== settings.backThickness) {
    throw new ConfigValidationError(
      'backMaterialId',
      `материал қалыңдығы ${backMat.thickness} мм, ал settings.backThickness = ${settings.backThickness} мм`,
      `екеуі тең болуы керек`,
    )
  }

  /** Бүйір/крышка/дно/полканың нақты тереңдігі. */
  const carcassDepth = D - backAllowance
  if (carcassDepth < MIN_DIMENSION) {
    throw new ConfigValidationError(
      'cabinet.depth',
      `арт қабырғаны шегергенде корпус тереңдігі ${carcassDepth} мм қалады`,
      `≥ ${MIN_DIMENSION + backAllowance} мм`,
    )
  }

  const innerWidth = W - 2 * t
  const innerHeight = H - 2 * t
  if (innerWidth < MIN_DIMENSION) {
    throw new ConfigValidationError('cabinet.width', `ішкі ені ${innerWidth} мм`, `≥ ${MIN_DIMENSION + 2 * t} мм`)
  }
  if (innerHeight < MIN_DIMENSION) {
    throw new ConfigValidationError('cabinet.height', `ішкі биіктігі ${innerHeight} мм`, `≥ ${MIN_DIMENSION + 2 * t} мм`)
  }

  const panels: Panel[] = []
  const make = (
    id: string,
    role: PanelRole,
    label: string,
    material: Material,
    finishedLength: number,
    finishedWidth: number,
    position: { x: number; y: number; z: number },
    orientation: Orientation,
  ): Panel => {
    const edges = resolveEdges(role, config.construction, config.edging)
    const { cutLength, cutWidth } = calculateCutDimensions(
      finishedLength, finishedWidth, edges, bands, settings,
    )
    return {
      id, role, label,
      materialId: material.id,
      finishedLength, finishedWidth,
      cutLength, cutWidth,
      edges,
      grainAlongLength: material.hasGrain,
      qty: 1,
      position,
      rotation: rotationFor(orientation),
      orientation,
      drilling: [], // §4.9 присадка — кейінгі кезең
    }
  }

  // ── Корпус (§4.4) ──────────────────────────────────────────────────────────
  if (config.construction === 'sidesOverlay') {
    // Бүйірлер толық биіктікте, крышка мен дно олардың АРАСЫНА кіреді.
    panels.push(make('side-left', 'side', 'Боковина', carcass, H, carcassDepth, { x: 0, y: 0, z: 0 }, ORIENT_SIDE))
    panels.push(make('side-right', 'side', 'Боковина', carcass, H, carcassDepth, { x: W - t, y: 0, z: 0 }, ORIENT_SIDE))
    panels.push(make('bottom', 'bottom', 'Дно', carcass, innerWidth, carcassDepth, { x: t, y: 0, z: 0 }, ORIENT_HORIZONTAL))
    panels.push(make('top', 'top', 'Крышка', carcass, innerWidth, carcassDepth, { x: t, y: H - t, z: 0 }, ORIENT_HORIZONTAL))
  } else {
    // Крышка мен дно толық енде, бүйірлер олардың АРАСЫНА кіреді.
    panels.push(make('bottom', 'bottom', 'Дно', carcass, W, carcassDepth, { x: 0, y: 0, z: 0 }, ORIENT_HORIZONTAL))
    panels.push(make('top', 'top', 'Крышка', carcass, W, carcassDepth, { x: 0, y: H - t, z: 0 }, ORIENT_HORIZONTAL))
    panels.push(make('side-left', 'side', 'Боковина', carcass, innerHeight, carcassDepth, { x: 0, y: t, z: 0 }, ORIENT_SIDE))
    panels.push(make('side-right', 'side', 'Боковина', carcass, innerHeight, carcassDepth, { x: W - t, y: t, z: 0 }, ORIENT_SIDE))
  }

  // ── Сөрелер (§4.6) ─────────────────────────────────────────────────────────
  const shelfCount = config.shelves.count
  if (!Number.isInteger(shelfCount) || shelfCount < 0) {
    throw new ConfigValidationError('shelves.count', `${shelfCount}`, '0..20 бүтін сан')
  }
  if (shelfCount > 0) {
    const shelfLength = innerWidth - settings.shelfGap
    const shelfWidth = carcassDepth - settings.shelfSetback
    if (shelfWidth < MIN_DIMENSION) {
      throw new ConfigValidationError(
        'settings.shelfSetback',
        `сөре тереңдігі ${shelfWidth} мм қалады`,
        `≤ ${carcassDepth - MIN_DIMENSION} мм`,
      )
    }
    // Ішкі саңылау: сөрелер соны тең бөледі. Қалдық миллиметр АСТЫҢҒЫ
    // бөліктерден бастап таратылады — көз деңгейінен төмен жер аз көрінеді.
    const openingTotal = innerHeight - shelfCount * t
    const openings = distributeMillimetres(openingTotal, shelfCount + 1)
    let y = t
    for (let i = 0; i < shelfCount; i += 1) {
      y += openings[i] ?? 0
      panels.push(
        make(
          `shelf-${i + 1}`, 'shelf', 'Полка', carcass,
          shelfLength, shelfWidth,
          { x: t + Math.floor(settings.shelfGap / 2), y, z: settings.shelfSetback },
          ORIENT_HORIZONTAL,
        ),
      )
      y += t
    }
  }

  // ── Артқы қабырға (§4.5) ───────────────────────────────────────────────────
  if (config.back.mode === 'overlay') {
    // W × H, корпустың артына скобамен қағылады.
    panels.push(
      make('back', 'back', 'Задняя стенка', backMat, H, W, { x: 0, y: 0, z: carcassDepth }, ORIENT_FACING),
    )
  } else {
    const g = settings.grooveDepth
    panels.push(
      make(
        'back', 'back', 'Задняя стенка', backMat,
        innerHeight + 2 * g, innerWidth + 2 * g,
        { x: t - g, y: t - g, z: carcassDepth - backMat.thickness },
        ORIENT_FACING,
      ),
    )
  }

  // ── Фасадтар (§4.7) ────────────────────────────────────────────────────────
  if (config.fronts && config.fronts.count > 0) {
    const n = config.fronts.count
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      throw new ConfigValidationError('fronts.count', `${n}`, '1..8 бүтін сан')
    }
    const gap = settings.frontGap
    const inset = config.fronts.mount === 'inset'
    const spanX = inset ? innerWidth : W
    const spanY = inset ? innerHeight : H
    const originX = inset ? t : 0
    const originY = inset ? t : 0

    const usableWidth = spanX - (n + 1) * gap
    // Фасад ені бүтінге ТӨМЕН дөңгеленеді — фасадтар ӘРҚАШАН бірдей болуы керек,
    // себебі бірдей деталь цехта бір операцияда кесіледі.
    const frontWidth = Math.floor(usableWidth / n)
    if (frontWidth < 50) {
      throw new ConfigValidationError(
        'fronts.count',
        `${n} фасадта әрқайсысының ені ${frontWidth} мм болады`,
        `фасад ені ≥ 50 мм`,
      )
    }
    // Қалған миллиметрлер СЫРТҚЫ саңылаулардан бастап бір-бірлеп таратылады.
    const gaps = distributeMillimetres(spanX - n * frontWidth, n + 1, gapFillOrder(n + 1))
    const frontHeight = spanY - 2 * gap

    let x = originX
    for (let i = 0; i < n; i += 1) {
      x += gaps[i] ?? 0
      panels.push(
        make(
          `front-${i + 1}`, 'front', 'Фасад', frontMat,
          frontHeight, frontWidth,
          { x, y: originY + gap, z: inset ? 0 : -frontMat.thickness },
          ORIENT_FACING,
        ),
      )
      x += frontWidth
    }
  }

  return panels
}

function requireMaterial(map: Map<string, Material>, id: string, field: string): Material {
  const m = map.get(id)
  if (!m) {
    throw new ConfigValidationError(field, `материал табылмады: "${id}"`, [...map.keys()].join(' | '))
  }
  return m
}

function validateDimension(value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw new ConfigValidationError(field, `${value} — бүтін сан емес`, 'мм, бүтін сан')
  }
  if (value < MIN_DIMENSION || value > MAX_DIMENSION) {
    throw new ConfigValidationError(field, `${value} мм`, `${MIN_DIMENSION}..${MAX_DIMENSION} мм`)
  }
}
