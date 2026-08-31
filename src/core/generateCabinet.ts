/**
 * Конфигтен панель тізімін жасау. CLAUDE.md §3: бұл — жалғыз ақиқат көзі.
 * 3D те, деталировка да, раскрой да, баға да ОСЫ массивтен оқиды.
 *
 * Таза функция: React жоқ, three.js жоқ, күй (state) жоқ.
 */

import { mergeSettings } from './constants'
import { distributeMillimetres, gapFillOrder } from './distribute'
import {
  applyMilling, confirmatJoint, handleHoles, hingeHoles, runnerHoles, shelfPinHoles,
} from './drilling'
import { DEFAULT_HANDLE_ID, defaultHandleSpec } from './fittings'
import { fillingBandHeight } from './filling'
import { millingPaths, validateMilling } from './milling'
import type { HandleModel, HandleSpec, HingeSystem } from './fittings'
import { calculateCutDimensions, resolveEdges, subtractedThickness } from './edges'
import { ConfigValidationError } from './errors'
import { ORIENT_FACING, ORIENT_HORIZONTAL, ORIENT_SIDE, rotationFor } from './geometry'
import { frontSlots, layoutSections } from './sections'
import type {
  CabinetConfig, Catalog, ConstructionSettings, Material,
  Orientation, Panel, PanelBevel, PanelRole, Rail, Section, SectionContent, SettingsOverride,
} from './types'

/** Ең кіші жарамды габарит — бұдан кішісі корпус болмайды. */
const MIN_DIMENSION = 100
/**
 * Планканың ең кіші ені, мм.
 *
 * Бұл өндірістік ЕРЕЖЕ ЕМЕС, тек мағынасыздықтан сақтайтын шек: одан тар
 * жолақты кесу де, кромкалау да қиын. Корпустың `MIN_DIMENSION`-ы мұнда
 * жарамайды — царга 80–120 мм, ал фальш-панельдің саңылауы одан да тар
 * болуы мүмкін.
 */
const MIN_RAIL_WIDTH = 20
/**
 * Цокольдің алдыңғы жиектен шегінісі, мм. Аяқ тұратын орын — цех
 * стандартында әдетте 50 мм.
 */
const PLINTH_SETBACK = 50
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
  // Арт қабырға ЖОҚ болса, шегеретін де ештеңе жоқ: корпус толық тереңдікте.
  const backAllowance = config.back.mode === 'none'
    ? 0
    : isGroove ? settings.grooveInset : settings.backThickness

  /**
   * Бүйір/крышка/дно/перегородка тереңдігі. ЕКІ режимде де жиналған кабинеттің
   * жалпы тереңдігі ДӘЛ D болады:
   *   overlay — корпус D − backThickness, қалған 3 мм-ді сыртқа қағылған ХДФ толтырады
   *   groove  — ХДФ корпустың ІШІНДЕ, сондықтан корпус толық D тереңдікте
   */
  /**
   * Корпус детальдерінің тереңдігі.
   *
   * ⚠ ТҮЗЕТІЛДІ: «Без стенки» режимінде бұрын да `backThickness` шегеріліп
   * тұрған. Ол қате еді — арт қабырға болмаса, шегеретін де ештеңе жоқ, ал
   * корпус сұралғаннан 3 мм тайыз болып шығатын.
   */
  const carcassDepthOf = (d: number): number =>
    config.back.mode === 'none' ? d : isGroove ? d : d - settings.backThickness
  const carcassDepth = carcassDepthOf(D)

  /** Сөре тереңдігі: арт қабырғаға дейін барады, оның үстіне шықпайды. */
  const shelfDepth = D - backAllowance - settings.shelfSetback

  /**
   * Бұрыштық (переходной) корпус: тереңдігі солдан оңға өзгереді.
   *
   * Шектеулер ОСЫ ЖЕРДЕ, бір рет тексеріледі. Әрқайсысы қиғаш жазықтықтағы
   * бөлек геометрияны талап етеді, ал жартылай дұрыс присадканы цехтан басқа
   * ешкім байқамайды — сондықтан «болмайды» деп айқын айтқан адал.
   */
  const corner = config.corner
  if (corner) {
    if (corner.depthAtRight < MIN_DIMENSION || corner.depthAtRight > D) {
      throw new ConfigValidationError(
        'corner.depthAtRight', `${corner.depthAtRight}`,
        `${MIN_DIMENSION}..${D} мм (сол жақтың тереңдігінен аспауы керек)`,
      )
    }
    if (config.back.mode !== 'none') {
      throw new ConfigValidationError(
        'back.mode', config.back.mode,
        'бұрыштық корпуста арт қабырға әзірге жасалмайды — "none" қойыңыз',
      )
    }
    if (config.sections.length > 1) {
      throw new ConfigValidationError(
        'sections', `${config.sections.length}`,
        'бұрыштық корпуста перегородка әзірге жасалмайды — бір секция',
      )
    }
    for (const [i, section] of config.sections.entries()) {
      if (section.fronts && section.fronts.count > 0) {
        throw new ConfigValidationError(
          `sections[${i}].fronts`, 'есть',
          'қиғаш бетке ілгек присадкасы әзірге жасалмайды — фасадсыз қалдырыңыз',
        )
      }
      if (section.contents.some((c) => c.kind === 'drawers')) {
        throw new ConfigValidationError(
          `sections[${i}].contents`, 'ящики',
          'қиғаш корпуста направляющая әзірге жасалмайды',
        )
      }
    }
  }

  /** Оң жақтағы корпус тереңдігі. Бұрыштық емес корпуста — сол жақтікімен тең. */
  const carcassDepthRight = corner ? carcassDepthOf(corner.depthAtRight) : carcassDepth
  const shelfDepthRight = corner
    ? corner.depthAtRight - backAllowance - settings.shelfSetback
    : shelfDepth

  /**
   * Жатық детальдің (крышка, дно, сөре) қиғашы. Арты ҚАБЫРҒАҒА тіреледі,
   * сондықтан материал ен осінің СОҢЫНА тураланады.
   */
  const widthBevel = (left: number, right: number): PanelBevel | undefined =>
    corner ? { widthAtStart: left, widthAtEnd: right, alignWidth: 'end' } : undefined

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

  /**
   * Корпус тіректің ҮСТІНДЕ тұрады, сондықтан барлық панель осыған көтеріледі.
   * Жалғыз ерекшелік — цокольдің өзі: ол `y = -baseHeight` деп беріледі де,
   * көтерілгеннен кейін дәл еденге түседі.
   */
  const baseHeight = config.base ? config.base.height : 0
  if (config.base && (!Number.isInteger(baseHeight) || baseHeight < 10 || baseHeight > 400)) {
    throw new ConfigValidationError('base.height', `${baseHeight} мм`, '10..400 мм')
  }

  /**
   * Қиғаш төбе. `height` — БИІК жақ, `slope.lowHeight` — аласа жақ.
   * Тереңдік бойымен биіктік сызықты кемиді.
   */
  const slope = config.slope
  if (slope) {
    if (config.construction !== 'sidesOverlay') {
      throw new ConfigValidationError(
        'slope',
        'скошенный корпус пока только со сборкой «боковины накрывают крышку и дно»',
        'construction: sidesOverlay',
      )
    }
    if (!Number.isInteger(slope.lowHeight) || slope.lowHeight < MIN_DIMENSION) {
      throw new ConfigValidationError('slope.lowHeight', `${slope.lowHeight} мм`, `≥ ${MIN_DIMENSION} мм`)
    }
    if (slope.lowHeight >= H) {
      throw new ConfigValidationError(
        'slope.lowHeight', `${slope.lowHeight} мм, ал корпус ${H} мм`, 'аласа жағы биік жағынан КІШІ болуы керек',
      )
    }
  }

  /**
   * Берілген ТЕРЕҢДІКТЕГІ корпустың биіктігі. Қиғаш жоқ болса — әрқашан H.
   * `z` — корпустың алдыңғы бетінен есептелетін тереңдік.
   */
  /**
   * Берілген БИІКТІКТЕГІ сөренің орны мен тереңдігі.
   *
   * Қиғаштың астында сөре толық тереңдікке сыймайды. Артқа қиғайғанда ол
   * ҚЫСҚАРАДЫ (арт жиегі төбеге тіреледі), алға қиғайғанда — АРТҚА ЖЫЛЖИДЫ
   * (алдыңғы жиегі төбеге тіреледі). Екеуі де мансарда шкафының нақты
   * құрылысы, қате емес.
   */
  const shelfSpaceAt = (y: number): { z: number; depth: number } => {
    const front = settings.shelfSetback
    const back = D - backAllowance
    if (!slope) return { z: front, depth: back - front }

    const rise = H - slope.lowHeight
    if (slope.towards === 'back') {
      // Төбе артқа қарай төмендейді: сөренің АРТ жиегі шектеледі.
      const maxBack = Math.min(back, Math.round(((H - y) * D) / rise))
      return { z: front, depth: maxBack - front }
    }
    // Төбе алға қарай төмендейді: сөренің АЛД жиегі шектеледі.
    const minFront = Math.max(front, Math.round(((y - slope.lowHeight) * D) / rise))
    return { z: minFront, depth: back - minFront }
  }

  const heightAtDepth = (z: number): number => {
    if (!slope) return H
    const ratio = Math.min(1, Math.max(0, z / D))
    return slope.towards === 'back'
      ? H - (H - slope.lowHeight) * ratio
      : slope.lowHeight + (H - slope.lowHeight) * ratio
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
    const raised = { ...position, y: position.y + baseHeight }
    return {
      id, role, label,
      materialId: material.id,
      finishedLength, finishedWidth,
      cutLength, cutWidth,
      edges,
      grainAlongLength: material.hasGrain,
      qty: 1,
      position: raised,
      rotation: rotationFor(orientation),
      orientation,
      note,
      drilling: [],
      grooves: [],
      milling: [],
    }
  }

  // ── Корпус (§4.4) ──────────────────────────────────────────────────────────
  const sidesOverlay = config.construction === 'sidesOverlay'
  /**
   * Қиғашта бүйір — ТРАПЕЦИЯ. Өлшемі (заготовка) бұрынғыдай H × тереңдік:
   * станок алдымен тікбұрышты кеседі, содан кейін қиғашты кеседі.
   */
  const heightFront = heightAtDepth(0)
  const heightBack = heightAtDepth(carcassDepth)
  const sideBevel = slope ? { lengthAtStart: heightFront, lengthAtEnd: heightBack } : undefined
  const sideNote = slope ? `Скос ${heightFront} → ${heightBack} мм` : ''

  const sideLeft = sidesOverlay
    ? make('side-left', 'side', 'Боковина', carcass, H, carcassDepth, { x: 0, y: 0, z: 0 }, ORIENT_SIDE, sideNote)
    : make('side-left', 'side', 'Боковина', carcass, innerHeight, carcassDepth, { x: 0, y: t, z: 0 }, ORIENT_SIDE)
  // Бұрыштық корпуста оң бүйір ТАРЫРАҚ: ол өз тереңдігінде тұрады да,
  // қабырғаға тірелу үшін артқа жылжиды.
  const rightZ = corner ? carcassDepth - carcassDepthRight : 0
  const rightNote = corner ? `Глубина ${carcassDepthRight} мм` : sideNote
  const sideRight = sidesOverlay
    ? make('side-right', 'side', 'Боковина', carcass, H, carcassDepthRight, { x: W - t, y: 0, z: rightZ }, ORIENT_SIDE, rightNote)
    : make('side-right', 'side', 'Боковина', carcass, innerHeight, carcassDepthRight, { x: W - t, y: t, z: rightZ }, ORIENT_SIDE)
  if (sideBevel) {
    sideLeft.bevel = { ...sideBevel }
    sideRight.bevel = { ...sideBevel }
  }
  const bottom = sidesOverlay
    ? make('bottom', 'bottom', 'Дно', carcass, innerWidth, carcassDepth, { x: t, y: 0, z: 0 }, ORIENT_HORIZONTAL)
    : make('bottom', 'bottom', 'Дно', carcass, W, carcassDepth, { x: 0, y: 0, z: 0 }, ORIENT_HORIZONTAL)
  const cornerBevel = widthBevel(carcassDepth, carcassDepthRight)
  if (cornerBevel) bottom.bevel = { ...cornerBevel }
  /**
   * Қиғашта крышка КӨЛБЕУ жатады: ені — гипотенуза, ал 3D-де ол X осі
   * бойынша бұрылады. Деталь ТІКБҰРЫШ болып қалады — цех оны солай кеседі.
   */
  const slopeRise = heightFront - heightBack
  const slopeAngle = slope ? Math.atan2(slopeRise, carcassDepth) : 0
  const topWidth = slope
    ? Math.round(Math.sqrt(carcassDepth * carcassDepth + slopeRise * slopeRise))
    : carcassDepth

  const top = sidesOverlay
    ? make(
        'top', 'top', 'Крышка', carcass, innerWidth, topWidth,
        // Көлбеу крышкада қалыңдық ТӨМЕН қарай кетеді (жатық панельдің
        // келісімі), сондықтан бастауы дәл биік жиектің деңгейінде.
        { x: t, y: slope ? heightFront : H - t, z: 0 }, ORIENT_HORIZONTAL,
        slope ? `Наклонная, ${Math.round((slopeAngle * 180) / Math.PI)}°` : '',
      )
    : make('top', 'top', 'Крышка', carcass, W, carcassDepth, { x: 0, y: H - t, z: 0 }, ORIENT_HORIZONTAL)
  if (slope) {
    // Көлбеуді 3D оқиды: панель өз жазықтығында тікбұрыш күйінде қалады.
    top.rotation = { ...top.rotation, x: top.rotation.x + (slopeAngle * 180) / Math.PI }
  }
  if (cornerBevel) top.bevel = { ...cornerBevel }

  // Рет деталировкадағы жолдардың ретін анықтайды — өзгертпе, snapshot соған қарайды.
  if (config.openTop) {
    // Үсті ашық корпуста крышка ЖОҚ, бірақ ол әлі де геометрия үшін керек:
    // сөрелер мен фасадтардың есебі ішкі биіктікке сүйенеді, ал ол крышканың
    // қалыңдығын есептейді. Сондықтан деталь тізімге түспейді, есеп өзгермейді.
    if (sidesOverlay) panels.push(sideLeft, sideRight, bottom)
    else panels.push(bottom, sideLeft, sideRight)
  } else if (sidesOverlay) {
    panels.push(sideLeft, sideRight, bottom, top)
  } else {
    panels.push(bottom, top, sideLeft, sideRight)
  }

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
      const dividerBevel = widthBevel(shelfDepth, shelfDepthRight)
      if (dividerBevel) divider.bevel = { ...dividerBevel }
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
          const space = shelfSpaceAt(y + t)
          if (space.depth < MIN_DIMENSION) {
            throw new ConfigValidationError(
              `sections[${sectionIndex}].contents[${bandIndex}].count`,
              `полка на высоте ${y} мм упирается в скос: остаётся ${space.depth} мм глубины`,
              'уменьшите число полок или поднимите низкую сторону',
            )
          }
          const shelf = make(
            `${section.id}${bandTag(bandIndex)}-shelf-${i + 1}`, 'shelf', 'Полка', carcass,
            layout.width - settings.shelfGap, space.depth,
            { x: layout.x + Math.floor(settings.shelfGap / 2), y, z: space.z },
            ORIENT_HORIZONTAL,
            space.depth < shelfDepth ? `${note}. Укорочена под скос` : note,
          )
          // Бұрыштық корпуста сөре де ТРАПЕЦИЯ: тереңдігі бүйірлерімен бірге
          // өзгереді, әйтпесе оң жағы қиғаш алдыңғы жиектен шығып тұрар еді.
          const shelfBevel = widthBevel(space.depth, shelfDepthRight)
          if (shelfBevel) shelf.bevel = { ...shelfBevel }
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
  if (config.back.mode === 'none') {
    // Арт қабырғасыз: ашық стеллаж, стол, кереует каркасы. Қатаңдықты
    // цех өзі шешеді (бұрыштық бекітпе, қабырғаға бұрандалау).
  } else if (config.back.mode === 'overlay') {
    // W × H, корпустың артына скобамен қағылады.
    //
    // Кең шкафта арт қабырға бір парақтан ШЫҚПАЙДЫ (2400 мм ені 2070 мм
    // параққа сыймайды). Цех оны бірнеше бөліктен қағады — біз де солай
    // істейміз, әйтпесе раскрой «сыймайды» деп тұрып алады.
    const pieces = backPieceCount(H, W, backMat)
    const widths = distributeMillimetres(W, pieces)
    let x = 0
    widths.forEach((pieceWidth, i) => {
      panels.push(
        make(
          pieces === 1 ? 'back' : `back-${i + 1}`, 'back', 'Задняя стенка', backMat,
          H, pieceWidth, { x, y: 0, z: carcassDepth }, ORIENT_FACING,
          pieces === 1 ? 'ХДФ внакладку, на скобы' : `ХДФ внакладку, часть ${i + 1} из ${pieces}`,
        ),
      )
      x += pieceWidth
    })
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

  // ── Цоколь мен столешница ──────────────────────────────────────────────────
  if (config.base?.kind === 'plinth') {
    // Цоколь алдыңғы жиектен ішке шегіндіріледі: аяқ тұратын орын.
    panels.push(
      make(
        'plinth', 'plinth', 'Цоколь', carcass,
        W, baseHeight,
        { x: 0, y: -baseHeight, z: PLINTH_SETBACK }, ORIENT_FACING,
        'Цоколь, лицевой',
      ),
    )
  }

  if (config.worktop) {
    const worktopMat = config.worktop.materialId
      ? requireMaterial(materials, config.worktop.materialId, 'worktop.materialId')
      : carcass
    const overhangFront = config.worktop.overhangFront
    const overhangSides = config.worktop.overhangSides
    panels.push(
      make(
        'worktop', 'top', 'Столешница', worktopMat,
        W + 2 * overhangSides, D + overhangFront,
        { x: -overhangSides, y: H, z: -overhangFront }, ORIENT_HORIZONTAL,
        'Столешница, накладная',
      ),
    )
  }

  // ── Планкалар мен фальш-панельдер ──────────────────────────────────────────
  //
  // Планка — тар деталь, сондықтан оның ҚАЙ ЖЕРДЕ тұратыны түріне байланысты.
  // Ережелер осында, бір жерде жазылған: кейін оқыған адам «неге бұлай» деп
  // кодты қуалап жүрмеуі керек.
  const makeRail = (rail: Rail): Panel => {
    if (rail.width < MIN_RAIL_WIDTH) {
      throw new ConfigValidationError(`rails.${rail.id}.width`, `${rail.width}`, `≥ ${MIN_RAIL_WIDTH} мм`)
    }
    const mat = rail.materialId
      ? requireMaterial(materials, rail.materialId, `rails.${rail.id}.materialId`)
      : rail.kind === 'carcass'
        ? carcass
        : requireMaterial(materials, config.frontMaterialId, 'frontMaterialId')

    const label = rail.kind === 'filler' ? 'Фальш-панель' : 'Планка'
    const id = `rail-${rail.id}`

    if (rail.kind === 'filler') {
      // Фальш-панель корпустың ЖАНЫНДА, фасадтың жазықтығында тұрады.
      if (rail.position !== 'left' && rail.position !== 'right') {
        throw new ConfigValidationError(
          `rails.${rail.id}.position`, rail.position, 'фальш-панель тек left/right',
        )
      }
      const x = rail.position === 'left' ? -rail.width - rail.inset : W + rail.inset
      return make(
        id, 'rail', label, mat, H, rail.width,
        { x, y: baseHeight, z: -mat.thickness }, ORIENT_FACING,
        `${label}, ${rail.position === 'left' ? 'слева' : 'справа'}`,
      )
    }

    // Фасадтық планка корпустың АЛДЫНДА, корпустық — ІШІНДЕ.
    const z = rail.kind === 'facade' ? -mat.thickness : rail.depthOffset

    if (rail.position === 'top' || rail.position === 'bottom') {
      const span = W - 2 * t - 2 * rail.inset
      if (span < MIN_DIMENSION) {
        throw new ConfigValidationError(
          `rails.${rail.id}.inset`, `просвет ${span} мм`, `≥ ${MIN_DIMENSION} мм`,
        )
      }
      // Царганың ҮСТІҢГІ беті корпустың сол деңгейімен беттеседі.
      const y = rail.position === 'top' ? H - t + baseHeight : baseHeight
      return make(
        id, 'rail', label, mat, span, rail.width,
        { x: t + rail.inset, y, z }, ORIENT_HORIZONTAL,
        `${label}, ${rail.position === 'top' ? 'верхняя' : 'нижняя'}`,
      )
    }

    const span = H - 2 * t - 2 * rail.inset
    if (span < MIN_DIMENSION) {
      throw new ConfigValidationError(
        `rails.${rail.id}.inset`, `просвет ${span} мм`, `≥ ${MIN_DIMENSION} мм`,
      )
    }
    const x = rail.position === 'left' ? t : W - t - mat.thickness
    return make(
      id, 'rail', label, mat, span, rail.width,
      { x, y: t + rail.inset + baseHeight, z }, ORIENT_SIDE,
      `${label}, ${rail.position === 'left' ? 'левая' : 'правая'}`,
    )
  }

  for (const rail of config.rails ?? []) {
    panels.push(makeRail(rail))
  }

  // ── Фартук ─────────────────────────────────────────────────────────────────
  if (config.backsplash) {
    const mat = config.backsplash.materialId
      ? requireMaterial(materials, config.backsplash.materialId, 'backsplash.materialId')
      : requireMaterial(materials, config.frontMaterialId, 'frontMaterialId')
    if (config.backsplash.height < MIN_DIMENSION) {
      throw new ConfigValidationError(
        'backsplash.height', `${config.backsplash.height}`, `≥ ${MIN_DIMENSION} мм`,
      )
    }
    // Фартук столешницаның ҮСТІНЕ отырады: онсыз ол столешницаның артына
    // тығылып қалар еді.
    const worktopThickness = config.worktop
      ? (config.worktop.materialId
        ? requireMaterial(materials, config.worktop.materialId, 'worktop.materialId').thickness
        : carcass.thickness)
      : 0
    panels.push(
      make(
        'backsplash', 'rail', 'Фартук', mat,
        config.backsplash.height, W,
        { x: 0, y: H + baseHeight + worktopThickness, z: D - mat.thickness },
        ORIENT_FACING,
        'Фартук, к стене',
      ),
    )
  }

  // ── Купе есіктері ──────────────────────────────────────────────────────────
  //
  // Купе БҮКІЛ корпустың алдын жабады: есіктер бір-бірін `slidingDoorOverlap`
  // мөлшерінде жауып, рельспен сырғанайды. Деталировкаға тек ЛДСП ВСТАВКА
  // түседі — профильдің өзі кесілмейді, сатып алынады.
  if (config.sliding) {
    const n = config.sliding.count
    if (!Number.isInteger(n) || n < 2 || n > 4) {
      throw new ConfigValidationError('sliding.count', `${n}`, '2..4 бүтін сан')
    }
    if (layouts.some((l) => l.section.fronts && l.section.fronts.count > 0)) {
      throw new ConfigValidationError(
        'sliding',
        'на корпусе одновременно двери-купе и распашные фасады',
        'оставьте что-то одно',
      )
    }

    const doorHeight = H - settings.slidingTrackTopSpace - settings.slidingTrackBottomSpace
    // Есіктер бір-бірін жабады, сондықтан жалпы ені корпустан АРТЫҚ.
    const doorWidth = Math.floor((W + settings.slidingDoorOverlap * (n - 1)) / n)
    const fillWidth = doorWidth - 2 * settings.slidingProfileSide
    const fillHeight = doorHeight - 2 * settings.slidingProfileTopBottom
    if (fillWidth < MIN_DIMENSION || fillHeight < MIN_DIMENSION) {
      throw new ConfigValidationError(
        'sliding.count',
        `вставка получается ${fillHeight}×${fillWidth} мм`,
        'каждая сторона ≥ 100 мм — проверьте профиль в настройках цеха',
      )
    }

    // Есіктер сатылы тұрады: тақтары алдыңғы рельсте, жұптары артқы рельсте.
    const trackDepth = 12
    for (let i = 0; i < n; i += 1) {
      const x = Math.round((W - doorWidth) * (n === 1 ? 0 : i / (n - 1)))
      panels.push(
        make(
          `sliding-${i + 1}`, 'front', 'Вставка двери-купе', frontMat,
          fillHeight, fillWidth,
          {
            x: x + settings.slidingProfileSide,
            y: settings.slidingTrackBottomSpace + settings.slidingProfileTopBottom,
            z: -(i % 2 === 0 ? trackDepth : trackDepth * 2) - frontMat.thickness,
          },
          ORIENT_FACING,
          `Дверь-купе ${i + 1} из ${n}, вставка в профиль`,
        ),
      )
    }
  }

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
      shelfPinHoles(left, shelf, t + baseHeight, ctx)
      shelfPinHoles(right, shelf, t + baseHeight, ctx)
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
    const spec = layouts[group.sectionIndex]?.section.fronts
    const hingeSystem = resolveHingeSystem(catalog, spec?.hingeSystemId)
    const handle = resolveHandle(catalog, spec?.handle)
    const milling = spec?.milling ?? null

    group.fronts.forEach((front, i) => {
      const side: 'left' | 'right' = i === last && last > 0 ? 'right' : i % 2 === 0 ? 'left' : 'right'
      const carcassPanel = i === 0 ? left : i === last ? right : undefined
      hingeHoles(front, carcassPanel, side, ctx, hingeSystem)
      if (handle) handleHoles(front, handle.model, handle.spec, ctx)
      if (milling) {
        validateMilling(milling, ctx.thickness(front))
        applyMilling(front, millingPaths(milling, front.finishedWidth, front.finishedLength), ctx)
      }
    })
  }

  return panels
}

/**
 * Секцияның ілгек жүйесі. Каталогта жүйе болмаса (ескі шақыру) —
 * `undefined`, ол кезде `hingeHoles` §4.9 константаларымен жүреді.
 */
function resolveHingeSystem(catalog: Catalog, id: string | undefined): HingeSystem | undefined {
  const list = catalog.hingeSystems
  if (!list || list.length === 0) return undefined
  if (!id) return list[0]
  const found = list.find((h) => h.id === id)
  if (!found) {
    throw new ConfigValidationError('fronts.hingeSystemId', `жүйе табылмады: "${id}"`)
  }
  return found
}

/**
 * Секцияның тұтқасы. `null` — әдейі тұтқасыз; `undefined` — цехтың әдепкісі.
 * Каталогта тұтқа болмаса тесік те бұрғыланбайды.
 */
function resolveHandle(
  catalog: Catalog,
  spec: HandleSpec | null | undefined,
): { model: HandleModel; spec: HandleSpec } | undefined {
  const list = catalog.handles
  if (!list || list.length === 0) return undefined
  if (spec === null) return undefined
  const wanted = spec ?? defaultHandleSpec()
  const model = list.find((h) => h.id === wanted.handleId)
    ?? (spec ? undefined : list.find((h) => h.id === DEFAULT_HANDLE_ID) ?? list[0])
  if (!model) {
    throw new ConfigValidationError('fronts.handle.handleId', `тұтқа табылмады: "${wanted.handleId}"`)
  }
  return { model, spec: wanted }
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

/**
 * Бірнеше корпустың панельдерін БІР тізімге жинау.
 *
 * `generateCabinet` id-лерді бір корпустың ішінде ғана бірегей етеді
 * (`side-left`, `back`, …) — олай болмаса, сақталған жоба мен эталон тестер
 * әр өзгерісте сынар еді. Ал жоба бойынша раскрой мен экспортта БАРЛЫҚ
 * деталь бір тізімге түседі, сонда id-лер қабаттасады да, DXF архивінде
 * бір файл екіншісін үнсіз басып кетеді.
 *
 * Сондықтан жобаға жинағанда id корпустың атауымен префиксталады.
 */
export function mergeProjectPanels(items: { cabinetId: string; panels: Panel[] }[]): Panel[] {
  if (items.length === 1) return items[0]!.panels
  return items.flatMap(({ cabinetId, panels }) =>
    panels.map((panel) => ({ ...panel, id: `${cabinetId}--${panel.id}` })),
  )
}

/**
 * Арт қабырға неше бөліктен жасалады.
 *
 * Парақтан шықпайтын деталь — қате емес: цехта кең шкафтың арты әрқашан
 * бірнеше кесіндіден қағылады. Ең аз бөлікті іздейміз, себебі әр қосымша
 * түйіс — қосымша жұмыс.
 */
export function backPieceCount(height: number, width: number, material: Material): number {
  const usableWidth = material.sheetWidth - 2 * material.trimEdge
  const usableHeight = material.sheetHeight - 2 * material.trimEdge
  const fits = (l: number, w: number): boolean =>
    (l <= usableWidth && w <= usableHeight) ||
    (!material.hasGrain && l <= usableHeight && w <= usableWidth)

  for (let pieces = 1; pieces <= 8; pieces += 1) {
    if (fits(height, Math.ceil(width / pieces))) return pieces
  }
  // Сыймаса да бір бөлік болып қалады — оны раскрой «сыймайды» деп айтады.
  return 1
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
  const list: SectionContent[] = contents.length > 0 ? [...contents] : [{ kind: 'empty' }]

  /**
   * Механизм мен техниканың ӨЗ табиғи биіктігі бар: духовканың ұясы шкафтың
   * қалған бос орнына созылмауы керек. Сондықтан олар биіктігі көрсетілмесе
   * де БЕКІТІЛГЕН болып саналады.
   */
  const isNatural = (c: SectionContent): boolean =>
    c.height === undefined && (c.kind === 'filling' || c.kind === 'appliance')

  /**
   * Бірақ бәрі бекітілген болса, артық орынды алатын ешкім қалмайды. Ол —
   * қате емес: духовканың үстінде жай ғана ашық орын тұрады. Сол орынды
   * АЙҚЫН жолақ етіп қосамыз — сонда оның астына бөлгіш сөре шығады, ал
   * нақты жиһаз дәл солай жиналады.
   *
   * Пайдаланушы биіктікті ӨЗІ жазған жағдайға бұл ереже ТИМЕЙДІ: онда
   * сандар қосылмаса, бұл шынымен де қате.
   */
  if (list.length > 0 && list.every(isNatural)) {
    const used = list.reduce<number>((sum, c) => sum + fillingBandHeight(c), 0)
    const available = innerHeight - list.length * thickness
    if (used < available - MIN_DIMENSION) list.push({ kind: 'empty' })
  }

  const free = innerHeight - (list.length - 1) * thickness
  if (free < MIN_DIMENSION) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents`,
      `${list.length} полос(ы) в высоте ${innerHeight} мм`,
      `на полосы остаётся ≥ ${MIN_DIMENSION} мм`,
    )
  }

  /** `height` жоқ жолақ бос орынды бөліседі; табиғи биіктік — бекітілген. */
  const naturalHeight = (c: SectionContent): number | undefined => {
    if (c.height !== undefined) return c.height
    if (isNatural(c)) return fillingBandHeight(c)
    return undefined
  }
  const wanted = list.map(naturalHeight)

  const fixedTotal = wanted.reduce<number>((sum, h) => sum + (h ?? 0), 0)
  const flexIndexes = wanted.map((h, i) => (h === undefined ? i : -1)).filter((i) => i >= 0)

  if (fixedTotal > free || (flexIndexes.length === 0 && fixedTotal !== free)) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents`,
      `заданные высоты полос дают ${fixedTotal} мм`,
      `доступно ${free} мм`,
    )
  }

  const heights = wanted.map((h) => h ?? 0)
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
