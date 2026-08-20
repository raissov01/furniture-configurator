/**
 * Конфигтен панель тізімін жасау. CLAUDE.md §3: бұл — жалғыз ақиқат көзі.
 * 3D те, деталировка да, раскрой да, баға да ОСЫ массивтен оқиды.
 *
 * Таза функция: React жоқ, three.js жоқ, күй (state) жоқ.
 */

import { mergeSettings } from './constants'
import { distributeMillimetres, gapFillOrder } from './distribute'
import { calculateCutDimensions, resolveEdges } from './edges'
import { ConfigValidationError } from './errors'
import { ORIENT_FACING, ORIENT_HORIZONTAL, ORIENT_SIDE, rotationFor } from './geometry'
import { frontSlots, layoutSections } from './sections'
import type {
  CabinetConfig, Catalog, ConstructionSettings, Material,
  Orientation, Panel, PanelRole, Section, SettingsOverride,
} from './types'

/** Ең кіші жарамды габарит — бұдан кішісі корпус болмайды. */
const MIN_DIMENSION = 100
/** Ең үлкен габарит: бір парақтан ұзын. Бөлу (A2) кейінгі кезеңде. */
const MAX_DIMENSION = 4000
/** Фасад бұдан тар болса — ілгек орнатылмайды. */
const MIN_FRONT_WIDTH = 50

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

  const isGroove = config.back.mode === 'groove'

  /**
   * Сөренің арт жиектен шегінісі — арт қабырға тұратын аймақ:
   *   overlay — ХДФ корпустың артына қағылады, сөре соған тірелмеуі керек
   *   groove  — ХДФ панельдің ішіндегі пазда отырады, сөре пазға дейін барады
   */
  const backAllowance = isGroove ? settings.grooveInset : settings.backThickness

  /**
   * Бүйір/крышка/дно/перегородка тереңдігі. ЕКІ режимде де жиналған кабинеттің
   * жалпы тереңдігі ДӘЛ D болады:
   *   overlay — корпус D − backThickness, қалған 3 мм-ді сыртқа қағылған ХДФ толтырады
   *   groove  — ХДФ корпустың ІШІНДЕ, сондықтан корпус толық D тереңдікте
   */
  const carcassDepth = isGroove ? D : D - settings.backThickness

  /** Сөре тереңдігі: арт қабырғаға дейін барады, оның үстіне шықпайды. */
  const shelfDepth = D - backAllowance - settings.shelfSetback

  if (config.back.mode === 'overlay' && backMat.thickness !== settings.backThickness) {
    throw new ConfigValidationError(
      'backMaterialId',
      `материал қалыңдығы ${backMat.thickness} мм, ал settings.backThickness = ${settings.backThickness} мм`,
      'екеуі тең болуы керек',
    )
  }

  if (carcassDepth < MIN_DIMENSION || shelfDepth < MIN_DIMENSION) {
    throw new ConfigValidationError(
      'cabinet.depth',
      `арт қабырғаны шегергенде корпус ${carcassDepth} мм, сөре ${shelfDepth} мм қалады`,
      `≥ ${MIN_DIMENSION + backAllowance + settings.shelfSetback} мм`,
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
    note = '',
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
      note,
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

  // ── Секциялар мен перегородкалар (A1) ──────────────────────────────────────
  const { layouts, dividerPositions } = layoutSections(config.sections, innerWidth, t, t)

  dividerPositions.forEach((x, i) => {
    panels.push(
      make(
        `divider-${i + 1}`, 'divider', 'Перегородка', carcass,
        innerHeight, carcassDepth, { x, y: t, z: 0 }, ORIENT_SIDE,
      ),
    )
  })

  // ── Секция ішіндегі сөрелер (§4.6) ─────────────────────────────────────────
  layouts.forEach((layout, sectionIndex) => {
    const { section } = layout
    if (section.contents.length > 1) {
      throw new ConfigValidationError(
        `sections[${sectionIndex}].contents`,
        `${section.contents.length} элемент`,
        'M2-де 0 немесе 1 (тік қабаттау — D1)',
      )
    }
    const content = section.contents[0]
    if (!content || content.kind !== 'shelves' || content.count === 0) return

    if (!Number.isInteger(content.count) || content.count < 0 || content.count > 20) {
      throw new ConfigValidationError(
        `sections[${sectionIndex}].contents[0].count`, `${content.count}`, '0..20 бүтін сан',
      )
    }

    const shelfLength = layout.width - settings.shelfGap
    if (shelfDepth < MIN_DIMENSION) {
      throw new ConfigValidationError(
        'settings.shelfSetback',
        `сөре тереңдігі ${shelfDepth} мм қалады`,
        `≤ ${D - backAllowance - MIN_DIMENSION} мм`,
      )
    }

    // Ішкі саңылау: сөрелер соны тең бөледі. Қалдық миллиметр АСТЫҢҒЫ
    // бөліктерден бастап таратылады — көз деңгейінен төмен жер аз көрінеді.
    const openings = distributeMillimetres(innerHeight - content.count * t, content.count + 1)
    const note = content.shelfKind === 'fixed'
      ? 'Фиксированная, конфирмат'
      : 'На полкодержателях, шаг 32 мм'

    let y = t
    for (let i = 0; i < content.count; i += 1) {
      y += openings[i] ?? 0
      panels.push(
        make(
          `${section.id}-shelf-${i + 1}`, 'shelf', 'Полка', carcass,
          shelfLength, shelfDepth,
          { x: layout.x + Math.floor(settings.shelfGap / 2), y, z: settings.shelfSetback },
          ORIENT_HORIZONTAL, note,
        ),
      )
      y += t
    }
  })

  // ── Артқы қабырға (§4.5) ───────────────────────────────────────────────────
  if (config.back.mode === 'overlay') {
    // W × H, корпустың артына скобамен қағылады.
    panels.push(
      make('back', 'back', 'Задняя стенка', backMat, H, W, { x: 0, y: 0, z: carcassDepth },
        ORIENT_FACING, 'ХДФ внакладку, на скобы'),
    )
  } else {
    const g = settings.grooveDepth
    // ХДФ корпустың ішінде, пазда отырады: алдыңғы беті D − grooveInset-те,
    // яғни сөренің арт жиегімен беттеседі. Артында корпустың
    // (grooveInset − backThickness) мм-і қалады.
    panels.push(
      make(
        'back', 'back', 'Задняя стенка', backMat,
        innerHeight + 2 * g, innerWidth + 2 * g,
        { x: t - g, y: t - g, z: D - settings.grooveInset },
        ORIENT_FACING, 'ХДФ в паз 4 мм',
      ),
    )
  }

  // ── Фасадтар (§4.7) ────────────────────────────────────────────────────────
  const slots = frontSlots(dividerPositions, W, t)
  layouts.forEach((layout, sectionIndex) => {
    const fronts = layout.section.fronts
    if (!fronts || fronts.count === 0) return

    const inset = fronts.mount === 'inset'
    // Накладной фасад боковина/перегородканы жабады → ұясы кеңірек.
    // Вкладной фасад секцияның ішіне кіреді → ұясы = таза секция ені.
    const slot = inset
      ? { x: layout.x, width: layout.width }
      : slots[sectionIndex] ?? { x: layout.x, width: layout.width }

    panels.push(
      ...makeFronts(
        layout.section, sectionIndex, fronts, slot,
        inset ? innerHeight : H, inset ? t : 0,
        inset ? 0 : -frontMat.thickness,
        frontMat, settings, make,
      ),
    )
  })

  return panels
}

type MakePanel = (
  id: string, role: PanelRole, label: string, material: Material,
  finishedLength: number, finishedWidth: number,
  position: { x: number; y: number; z: number },
  orientation: Orientation, note?: string,
) => Panel

function makeFronts(
  section: Section,
  sectionIndex: number,
  fronts: { count: number; mount: 'overlay' | 'inset' },
  slot: { x: number; width: number },
  spanY: number,
  originY: number,
  z: number,
  material: Material,
  settings: ConstructionSettings,
  make: MakePanel,
): Panel[] {
  const n = fronts.count
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    throw new ConfigValidationError(`sections[${sectionIndex}].fronts.count`, `${n}`, '1..8 бүтін сан')
  }
  const gap = settings.frontGap
  const usableWidth = slot.width - (n + 1) * gap
  // Фасад ені бүтінге ТӨМЕН дөңгеленеді — бір ұядағы фасадтар ӘРҚАШАН бірдей
  // болуы керек, себебі бірдей деталь цехта бір операцияда кесіледі.
  const frontWidth = Math.floor(usableWidth / n)
  if (frontWidth < MIN_FRONT_WIDTH) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].fronts.count`,
      `${n} фасадта әрқайсысының ені ${frontWidth} мм болады`,
      `фасад ені ≥ ${MIN_FRONT_WIDTH} мм`,
    )
  }
  // Қалған миллиметрлер СЫРТҚЫ саңылаулардан бастап бір-бірлеп таратылады.
  const gaps = distributeMillimetres(slot.width - n * frontWidth, n + 1, gapFillOrder(n + 1))
  const frontHeight = spanY - 2 * gap
  const note = fronts.mount === 'inset' ? 'Фасад вкладной' : 'Фасад накладной'

  const out: Panel[] = []
  let x = slot.x
  for (let i = 0; i < n; i += 1) {
    x += gaps[i] ?? 0
    out.push(
      make(
        `${section.id}-front-${i + 1}`, 'front', 'Фасад', material,
        frontHeight, frontWidth, { x, y: originY + gap, z }, ORIENT_FACING, note,
      ),
    )
    x += frontWidth
  }
  return out
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
