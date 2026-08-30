/**
 * Конфигтен панель тізімін жасау. CLAUDE.md §3: бұл — жалғыз ақиқат көзі.
 * 3D те, деталировка да, раскрой да, баға да ОСЫ массивтен оқиды.
 *
 * Таза функция: React жоқ, three.js жоқ, күй (state) жоқ.
 */

import { mergeSettings } from './constants'
import { distributeMillimetres, gapFillOrder } from './distribute'
import { confirmatJoint, hingeHoles, runnerHoles, shelfPinHoles } from './drilling'
import { calculateCutDimensions, resolveEdges, subtractedThickness } from './edges'
import { ConfigValidationError } from './errors'
import { ORIENT_FACING, ORIENT_HORIZONTAL, ORIENT_SIDE, rotationFor } from './geometry'
import { frontSlots, layoutSections } from './sections'
import type {
  CabinetConfig, Catalog, ConstructionSettings, Material,
  Orientation, Panel, PanelRole, Section, SectionContent, SettingsOverride,
} from './types'

/** Ең кіші жарамды габарит — бұдан кішісі корпус болмайды. */
const MIN_DIMENSION = 100
/** Ящик қорабының ең аз биіктігі. Бұл — ақылға қонымды еден, цех ережесі емес. */
const MIN_DRAWER_BOX_HEIGHT = 60
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
      drilling: [],
      grooves: [],
    }
  }

  // ── Корпус (§4.4) ──────────────────────────────────────────────────────────
  const sidesOverlay = config.construction === 'sidesOverlay'
  const sideLeft = sidesOverlay
    ? make('side-left', 'side', 'Боковина', carcass, H, carcassDepth, { x: 0, y: 0, z: 0 }, ORIENT_SIDE)
    : make('side-left', 'side', 'Боковина', carcass, innerHeight, carcassDepth, { x: 0, y: t, z: 0 }, ORIENT_SIDE)
  const sideRight = sidesOverlay
    ? make('side-right', 'side', 'Боковина', carcass, H, carcassDepth, { x: W - t, y: 0, z: 0 }, ORIENT_SIDE)
    : make('side-right', 'side', 'Боковина', carcass, innerHeight, carcassDepth, { x: W - t, y: t, z: 0 }, ORIENT_SIDE)
  const bottom = sidesOverlay
    ? make('bottom', 'bottom', 'Дно', carcass, innerWidth, carcassDepth, { x: t, y: 0, z: 0 }, ORIENT_HORIZONTAL)
    : make('bottom', 'bottom', 'Дно', carcass, W, carcassDepth, { x: 0, y: 0, z: 0 }, ORIENT_HORIZONTAL)
  const top = sidesOverlay
    ? make('top', 'top', 'Крышка', carcass, innerWidth, carcassDepth, { x: t, y: H - t, z: 0 }, ORIENT_HORIZONTAL)
    : make('top', 'top', 'Крышка', carcass, W, carcassDepth, { x: 0, y: H - t, z: 0 }, ORIENT_HORIZONTAL)

  // Рет деталировкадағы жолдардың ретін анықтайды — өзгертпе, snapshot соған қарайды.
  if (sidesOverlay) panels.push(sideLeft, sideRight, bottom, top)
  else panels.push(bottom, top, sideLeft, sideRight)

  // ── Секциялар мен перегородкалар (A1) ──────────────────────────────────────
  const { layouts, dividerPositions } = layoutSections(config.sections, innerWidth, t, t)

  const dividers = dividerPositions.map((x, i) =>
    make(
      `divider-${i + 1}`, 'divider', 'Перегородка', carcass,
      innerHeight, carcassDepth, { x, y: t, z: 0 }, ORIENT_SIDE,
    ),
  )
  panels.push(...dividers)

  /** Секцияны екі жағынан шектейтін тік панельдер (конфирмат пен присадка үшін). */
  const boundsOf = (i: number): [Panel, Panel] => [
    i === 0 ? sideLeft : dividers[i - 1]!,
    i === layouts.length - 1 ? sideRight : dividers[i]!,
  ]

  // Накладной фасадтың ұясы: ол боковина/перегородканы жабады. Ящик фасады
  // да сол ұяны алады — әйтпесе ілмелі фасадпен бір қатарда тұрмайды.
  const slots = frontSlots(dividerPositions, W, t)

  // ── Секция ішіндегі толтырылым: тік жолақтар (D1) ──────────────────────────
  //
  // Секцияның ішкі биіктігі жолақтарға бөлінеді: [0] АСТЫҢҒЫ. Жолақтар
  // арасында бекітілген сөре тұрады — нақты жиһазда ящиктің үстіндегі сөре сол.
  const shelves: { shelf: Panel; sectionIndex: number; kind: 'adjustable' | 'fixed' }[] = []
  /** Секцияға ілмелі фасад қай биіктіктен басталады (ящик жолағының үстінен). */
  const hingedFrontFrom: number[] = layouts.map(() => t)
  const drawerRuns: {
    sectionIndex: number
    boxBottomY: number
    boxFrontZ: number
    boxDepth: number
  }[] = []

  layouts.forEach((layout, sectionIndex) => {
    const { section } = layout
    if (shelfDepth < MIN_DIMENSION) {
      throw new ConfigValidationError(
        'settings.shelfSetback',
        `сөре тереңдігі ${shelfDepth} мм қалады`,
        `≤ ${D - backAllowance - MIN_DIMENSION} мм`,
      )
    }

    const bands = layoutBands(section.contents, innerHeight, t, sectionIndex)
    // Бір ғана жолақ болса, id-лер БҰРЫНҒЫДАЙ қалады: сақталған жобалар мен
    // экспорт файлдарындағы сілтемелер сынбауы керек.
    const bandTag = (index: number) => (bands.length > 1 ? `-b${index + 1}` : '')

    // Жолақтардың арасындағы бекітілген сөре (разделитель).
    for (let i = 0; i < bands.length - 1; i += 1) {
      const band = bands[i]!
      const divider = make(
        `${section.id}-band-${i + 1}-divider`, 'shelf', 'Полка', carcass,
        layout.width - settings.shelfGap, shelfDepth,
        { x: layout.x + Math.floor(settings.shelfGap / 2), y: band.y + band.height, z: settings.shelfSetback },
        ORIENT_HORIZONTAL, 'Разделитель, фиксированная',
      )
      panels.push(divider)
      shelves.push({ shelf: divider, sectionIndex, kind: 'fixed' })
    }

    bands.forEach((band, bandIndex) => {
      const content = band.content

      if (content.kind === 'shelves' && content.count > 0) {
        if (!Number.isInteger(content.count) || content.count < 0 || content.count > 20) {
          throw new ConfigValidationError(
            `sections[${sectionIndex}].contents[${bandIndex}].count`, `${content.count}`, '0..20 бүтін сан',
          )
        }
        // Ішкі саңылау: сөрелер соны тең бөледі. Қалдық миллиметр АСТЫҢҒЫ
        // бөліктерден бастап таратылады — көз деңгейінен төмен жер аз көрінеді.
        const openings = distributeMillimetres(band.height - content.count * t, content.count + 1)
        const note = content.shelfKind === 'fixed'
          ? 'Фиксированная, конфирмат'
          : 'На полкодержателях, шаг 32 мм'

        let y = band.y
        for (let i = 0; i < content.count; i += 1) {
          y += openings[i] ?? 0
          const shelf = make(
            `${section.id}${bandTag(bandIndex)}-shelf-${i + 1}`, 'shelf', 'Полка', carcass,
            layout.width - settings.shelfGap, shelfDepth,
            { x: layout.x + Math.floor(settings.shelfGap / 2), y, z: settings.shelfSetback },
            ORIENT_HORIZONTAL, note,
          )
          panels.push(shelf)
          shelves.push({ shelf, sectionIndex, kind: content.shelfKind })
          y += t
        }
        return
      }

      if (content.kind === 'drawers') {
        const created = makeDrawers({
          section, sectionIndex, bandIndex, band, layout,
          slot: slots[sectionIndex] ?? { x: layout.x, width: layout.width },
          settings, carcass, frontMat, backMat, shelfDepth, make,
        })
        panels.push(...created.panels)
        for (const run of created.runs) {
          drawerRuns.push({ ...run, sectionIndex })
        }
        // Ілмелі фасад ящиктердің ҮСТІНЕН басталады: әйтпесе екеуі бір
        // жерді жауып, бірінің үстіне бірі шығады.
        hingedFrontFrom[sectionIndex] = Math.max(
          hingedFrontFrom[sectionIndex] ?? t,
          band.y + band.height + t,
        )
      }
    })
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
  const frontGroups: { fronts: Panel[]; sectionIndex: number }[] = []
  layouts.forEach((layout, sectionIndex) => {
    const fronts = layout.section.fronts
    if (!fronts || fronts.count === 0) return

    const inset = fronts.mount === 'inset'
    // Накладной фасад боковина/перегородканы жабады → ұясы кеңірек.
    // Вкладной фасад секцияның ішіне кіреді → ұясы = таза секция ені.
    const slot = inset
      ? { x: layout.x, width: layout.width }
      : slots[sectionIndex] ?? { x: layout.x, width: layout.width }

    // Секцияда ящик болса, ілмелі фасад солардың ҮСТІНЕН басталады —
    // әйтпесе екі фасад бір жерді жауып, бірінің үстіне бірі шығады.
    const from = hingedFrontFrom[sectionIndex] ?? t
    const stacked = from > t
    const originY = stacked ? from : (inset ? t : 0)
    const spanY = stacked ? (inset ? H - t - from : H - from) : (inset ? innerHeight : H)

    const created = makeFronts(
      layout.section, sectionIndex, fronts, slot,
      spanY, originY,
      inset ? 0 : -frontMat.thickness,
      frontMat, settings, make,
    )
    panels.push(...created)
    frontGroups.push({ fronts: created, sectionIndex })
  })

  // ── Паз (арт қабырға «в паз» болғанда) ─────────────────────────────────────
  if (isGroove) {
    // Паз корпустың ішкі бетінде, арт жиектен grooveInset шегініп жүреді.
    // Ұзындығы бойы толық фрезерленеді; тоқтатылған паз — кейінгі жақсарту.
    const grooveCentreZ = D - settings.grooveInset + backMat.thickness / 2
    for (const panel of [sideLeft, sideRight, bottom, top, ...dividers]) {
      const y = grooveCentreZ - subtractedThickness(panel.edges.L1, bands, settings)
      panel.grooves.push({
        face: 'inner',
        x1: 0, y1: y,
        x2: panel.cutLength, y2: y,
        width: backMat.thickness,
        depth: settings.grooveDepth,
      })
    }
  }

  // ── Присадка (§4.9) ────────────────────────────────────────────────────────
  const ctx = {
    thickness: (p: Panel) => materials.get(p.materialId)?.thickness ?? t,
    bands,
    settings,
  }

  // Конфирмат: корпус буындары
  if (sidesOverlay) {
    // Бұранда бүйірдің СЫРТЫНАН кіріп, крышка/дноның торціне барады
    for (const face of [sideLeft, sideRight]) {
      for (const edge of [bottom, top]) confirmatJoint(face, edge, ctx)
    }
  } else {
    // Бұранда крышка/дноның СЫРТЫНАН кіріп, бүйірдің торціне барады
    for (const face of [bottom, top]) {
      for (const edge of [sideLeft, sideRight]) confirmatJoint(face, edge, ctx)
    }
  }
  // Перегородка екі құрастыруда да крышка мен дноның арасында
  for (const divider of dividers) {
    confirmatJoint(bottom, divider, ctx)
    confirmatJoint(top, divider, ctx)
  }

  // Сөрелер: фиксированная — конфирмат, жылжымалы — полкодержатель
  for (const { shelf, sectionIndex, kind } of shelves) {
    const [left, right] = boundsOf(sectionIndex)
    if (kind === 'fixed') {
      confirmatJoint(left, shelf, ctx)
      confirmatJoint(right, shelf, ctx)
    } else {
      shelfPinHoles(left, shelf, t, ctx)
      shelfPinHoles(right, shelf, t, ctx)
    }
  }

  // Направляющая: ящиктің екі жағындағы тік панельге
  for (const run of drawerRuns) {
    const [left, right] = boundsOf(run.sectionIndex)
    runnerHoles(left, run.boxBottomY, run.boxFrontZ, run.boxDepth, ctx)
    runnerHoles(right, run.boxBottomY, run.boxFrontZ, run.boxDepth, ctx)
  }

  // Ілгектер: шеткі фасадтар секцияның тік панеліне ілінеді.
  // Ортадағы фасадтардың жанында тік панель жоқ, сондықтан оларға тек чашка.
  for (const group of frontGroups) {
    const [left, right] = boundsOf(group.sectionIndex)
    const last = group.fronts.length - 1
    group.fronts.forEach((front, i) => {
      const side: 'left' | 'right' = i === last && last > 0 ? 'right' : i % 2 === 0 ? 'left' : 'right'
      const carcassPanel = i === 0 ? left : i === last ? right : undefined
      hingeHoles(front, carcassPanel, side, ctx)
    })
  }

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

// ── Тік жолақтар мен ящиктер (D1) ────────────────────────────────────────────

type Band = { content: SectionContent; y: number; height: number }

/**
 * Секцияның ішкі биіктігін жолақтарға бөлу.
 *
 * `height` берілген жолақ дәл сонша алады, қалғандары қалған биіктікті тең
 * бөліседі. Жолақтар арасында бекітілген сөре тұрады — оның қалыңдығы да
 * есептен шығарылады, әйтпесе ішкі өлшемдер бір сөре қалыңдығына жылжып кетеді.
 */
export function layoutBands(
  contents: SectionContent[],
  innerHeight: number,
  thickness: number,
  sectionIndex: number,
): Band[] {
  const list: SectionContent[] = contents.length > 0 ? contents : [{ kind: 'empty' }]
  const free = innerHeight - (list.length - 1) * thickness
  if (free < MIN_DIMENSION) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents`,
      `${list.length} полос(ы) в высоте ${innerHeight} мм`,
      `на полосы остаётся ≥ ${MIN_DIMENSION} мм`,
    )
  }

  const fixedTotal = list.reduce((sum, c) => sum + (c.height ?? 0), 0)
  const flexIndexes = list.map((c, i) => (c.height === undefined ? i : -1)).filter((i) => i >= 0)

  if (fixedTotal > free || (flexIndexes.length === 0 && fixedTotal !== free)) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents`,
      `заданные высоты полос дают ${fixedTotal} мм`,
      `доступно ${free} мм`,
    )
  }

  const heights = list.map((c) => c.height ?? 0)
  if (flexIndexes.length > 0) {
    const shares = distributeMillimetres(free - fixedTotal, flexIndexes.length)
    flexIndexes.forEach((index, k) => {
      heights[index] = shares[k] ?? 0
    })
  }

  const out: Band[] = []
  let y = thickness
  list.forEach((content, i) => {
    out.push({ content, y, height: heights[i] ?? 0 })
    y += (heights[i] ?? 0) + thickness
  })
  return out
}

/**
 * Бір жолақтағы ящиктер: сыртқы фасад + қорап (2 бүйір, алды, арты, түбі).
 *
 * ⚠ Қораптың өлшемі ЦЕХТЫҢ направляющаясына байланысты (`drawerRunnerGap`,
 * `drawerBackGap`, `drawerBoxDrop`). Олар профильде түзетіледі.
 */
function makeDrawers(input: {
  section: Section
  sectionIndex: number
  bandIndex: number
  band: Band
  layout: { x: number; width: number }
  /** Накладной фасадтың ұясы (корпустың жиегін жабады) */
  slot: { x: number; width: number }
  settings: ConstructionSettings
  carcass: Material
  frontMat: Material
  backMat: Material
  shelfDepth: number
  make: MakePanel
}): { panels: Panel[]; runs: { boxBottomY: number; boxFrontZ: number; boxDepth: number }[] } {
  const { section, sectionIndex, bandIndex, band, layout, slot, settings, carcass, frontMat, backMat, shelfDepth, make } = input
  const content = band.content
  if (content.kind !== 'drawers') return { panels: [], runs: [] }

  const n = content.count
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents[${bandIndex}].count`, `${n}`, '1..8 бүтін сан',
    )
  }

  const gap = settings.frontGap
  const t = carcass.thickness
  // Фасадтар жолақты тең бөледі. Биіктік бүтінге ТӨМЕН дөңгеленеді — бір
  // жолақтағы фасадтар әрқашан бірдей болуы керек.
  const frontHeight = Math.floor((band.height - (n + 1) * gap) / n)
  if (frontHeight < MIN_DIMENSION) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents[${bandIndex}].count`,
      `${n} ящика дают фасад высотой ${frontHeight} мм`,
      `высота фасада ≥ ${MIN_DIMENSION} мм`,
    )
  }
  const gaps = distributeMillimetres(band.height - n * frontHeight, n + 1)

  const boxWidth = layout.width - 2 * settings.drawerRunnerGap
  const boxDepth = shelfDepth - settings.drawerBackGap
  const boxHeight = frontHeight - settings.drawerBoxDrop
  // Қораптың БИІКТІГІНЕ бөлек еден: 60–80 мм ұсақ заттарға арналған ящик —
  // қалыпты нәрсе, ал ені мен тереңдігі 100 мм-ден кем болса, ол ящик емес.
  if (boxWidth < MIN_DIMENSION || boxDepth < MIN_DIMENSION || boxHeight < MIN_DRAWER_BOX_HEIGHT) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents[${bandIndex}]`,
      `короб получается ${boxHeight}×${boxWidth}×${boxDepth} мм`,
      'каждая сторона ≥ 100 мм — проверьте зазоры ящика в профиле цеха',
    )
  }
  /** Алды мен арты бүйірлердің АРАСЫНА кіреді. */
  const wallLength = boxWidth - 2 * t

  const panels: Panel[] = []
  const runs: { boxBottomY: number; boxFrontZ: number; boxDepth: number }[] = []
  let y = band.y

  for (let i = 0; i < n; i += 1) {
    y += gaps[i] ?? 0
    const id = `${section.id}-b${bandIndex + 1}-drawer-${i + 1}`

    // Фасад: накладной, корпустың алдында.
    const front = make(
      `${id}-front`, 'front', 'Фасад ящика', frontMat,
      frontHeight, slot.width - 2 * gap,
      { x: slot.x + gap, y, z: -frontMat.thickness }, ORIENT_FACING, 'Фасад ящика, накладной',
    )
    panels.push(front)

    const boxX = layout.x + settings.drawerRunnerGap
    const boxY = y + settings.drawerBoxDrop / 2

    for (const [side, offsetX] of [['левая', 0], ['правая', boxWidth - t]] as const) {
      panels.push(
        make(
          `${id}-side-${side === 'левая' ? 'l' : 'r'}`, 'drawerSide', 'Боковина ящика', carcass,
          // ORIENT_SIDE: ұзындық Y (биіктік), ені Z (тереңдік) — корпустың
          // боковинасындағы келісіммен бірдей.
          boxHeight, boxDepth,
          { x: boxX + offsetX, y: boxY, z: settings.shelfSetback }, ORIENT_SIDE,
          'Короб ящика',
        ),
      )
    }

    for (const [wall, z] of [['front', settings.shelfSetback], ['back', settings.shelfSetback + boxDepth - t]] as const) {
      panels.push(
        make(
          // `-wall-` міндетті: фасадтың id-і `${id}-front`, ал ол екеуі бір
          // болса, DXF архивінде файл бірін-бірі басып кетеді.
          `${id}-wall-${wall}`, 'drawerBack',
          wall === 'front' ? 'Передняя стенка ящика' : 'Задняя стенка ящика', carcass,
          // ORIENT_FACING: ұзындық Y (биіктік), ені X.
          boxHeight, wallLength,
          { x: boxX + t, y: boxY, z }, ORIENT_FACING, 'Короб ящика',
        ),
      )
    }

    // Түбі ХДФ, қораптың астынан қағылады.
    panels.push(
      make(
        `${id}-bottom`, 'drawerBottom', 'Дно ящика', backMat,
        // ORIENT_HORIZONTAL: ұзындық X (ен), ені Z (тереңдік).
        boxWidth, boxDepth,
        { x: boxX, y: boxY - backMat.thickness, z: settings.shelfSetback }, ORIENT_HORIZONTAL,
        'Дно ящика, ХДФ',
      ),
    )

    runs.push({ boxBottomY: boxY, boxFrontZ: settings.shelfSetback, boxDepth })
    y += frontHeight
  }

  return { panels, runs }
}
