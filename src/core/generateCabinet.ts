/**
 * Конфигтен панель тізімін жасау. CLAUDE.md §3: бұл — жалғыз ақиқат көзі.
 * 3D те, деталировка да, раскрой да, баға да ОСЫ массивтен оқиды.
 *
 * Таза функция: React жоқ, three.js жоқ, күй (state) жоқ.
 */

import { LEG_SCREW_SQUARE, LEG_STEP, mergeSettings } from './constants'
import { distributeMillimetres, gapFillOrder } from './distribute'
import {
  applyMilling, confirmatJoint, drawerBottomJoints, drawerFacadeScrews, handleHoles, hingeHoles,
  legPairsFor, legScrewHoles, minifixJoint, runnerHoles, shelfPinHoles,
} from './drilling'
import { DEFAULT_HANDLE_ID, defaultHandleSpec, handleShape } from './fittings'
import { fillingBandHeight } from './filling'
import { millingPaths, validateMilling } from './milling'
import type { HandleModel, HandleSpec, HingeSystem } from './fittings'
import {
  calculateCutDimensions, carcassEdges, customPartEdges, resolveEdges, subtractedThickness,
} from './edges'
import { applyCutouts, applyPanelOverrides } from './cutouts'
import { applyDrillEdits } from './drillEdits'
import { ConfigValidationError } from './errors'
import {
  findDrawerSystem, findMetalBoxSystem, isMetalBoxSystem, metalBoxParts, nominalRunnerLength,
} from './drawerSystems'
import type { DrawerSystem, MetalBoxSystem } from './drawerSystems'
import { ORIENT_FACING, ORIENT_HORIZONTAL, ORIENT_SIDE, ORIENT_UPRIGHT, rotationFor } from './geometry'
import { frontSlots, layoutSections } from './sections'
import type {
  CabinetConfig, Catalog, ConstructionSettings, Material,
  FrontGaps, Orientation, Panel, PanelBevel, PanelEdges, PanelMount, PanelRole, Rail,
  PanelOpening, Section, SectionContent, SettingsOverride,
} from './types'

/**
 * Корпус детальдерінің (бүйір, дно, крыша) ТЕРЕҢДІГІ.
 *
 * ⚠ Модульден ТЫС қажет: аяқтың орны да, фурнитураның координатасы да осы
 * тереңдікте есептеледі. Бұрын оны `hardware.ts` өз бетінше есептейтін де,
 * накладной арт қабырғада 3 мм-ге алшақтап кететін — 3D-дегі аяқ пен
 * присадканың арасында дәл сол айырма пайда болатын.
 */
export function carcassDepthAt(
  config: CabinetConfig,
  settings: { backThickness: number; grooveInset: number },
  depth: number = config.depth,
): number {
  const isGroove = config.back.mode === 'groove'
  const isInsetBack = config.back.mode === 'inset'
  return config.back.mode === 'none' || isGroove || isInsetBack
    ? depth
    : depth - settings.backThickness
}

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
 * ⚠ ЕСКІРГЕН: шегіністі енді цех өз профилінде қояды
 * (`settings.plinthSetback`). Тұрақты тек сол әдепкінің көзі ретінде қалды.
 */
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
  /**
   * Направляющаның жүйесі. `null` — таңдалмаған: ол ЕСКІ мінез, өлшем цехтың
   * профилінен алынады (`drawerSystems.ts` қара).
   */
  const metalBox: MetalBoxSystem | null = config.drawerSystem && isMetalBoxSystem(config.drawerSystem)
    ? findMetalBoxSystem(config.drawerSystem)
    : null
  const drawerSystem: DrawerSystem | null = config.drawerSystem && !metalBox
    ? findDrawerSystem(config.drawerSystem)
    : null
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
  /**
   * ВКЛАДНОЙ арт қабырғаның шегінісі. Мұнда материалдың ӨЗ қалыңдығы
   * алынады, `settings.backThickness` емес: вкладной арт қабырға 3 мм ХДФ та,
   * 10 мм ЛДСП та болуы мүмкін, ал накладной режимде екеуінің тең болуы
   * тексеріліп тұр.
   */
  const isInsetBack = config.back.mode === 'inset'
  const backInset = config.back.inset ?? 0
  if (isInsetBack && (!Number.isInteger(backInset) || backInset < 0 || backInset > 200)) {
    throw new ConfigValidationError('back.inset', `${backInset} мм`, '0..200 мм, бүтін сан')
  }

  const backAllowance = config.back.mode === 'none'
    ? 0
    : isGroove ? settings.grooveInset
      : isInsetBack ? backInset + backMat.thickness
        : settings.backThickness

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
  const carcassDepthOf = (d: number): number => carcassDepthAt(config, settings, d)
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
    /**
     * K7 / audit C5: `slope` (мансарда скосы) мен `corner` (бұрыштық
     * трапеция) екеуі де жатық панельдің `bevel`-іне жазылады да, соңғысы
     * бұрынғысын ҮНСІЗ ауыстырады — екі байланыссыз қиғаш бір панельде
     * қатар «өмір сүреді». Мыс. `top.finishedWidth` corner-ден гипотенуза
     * болып шығады, ал `bevel.widthAtStart/End` slope-тан мүлде басқа
     * санды айтады — DXF (§K9) екеуін қосып мүлде басқа пішін салады.
     * Тіркесімге тыйым: анық қате үнсіз бұрыс геометрадан жақсы (§10).
     */
    if (config.slope) {
      throw new ConfigValidationError(
        'slope',
        'corner (бұрыштық трапеция) берілгенде slope (қиғаш төбе) қатар жасалмайды',
        'slope-ты алып тастаңыз немесе corner-ды алып тастаңыз — екеуін бірге қоюға болмайды',
      )
    }
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
          'қиғаш бетке ілгек присадкасы әзірге жасалмайды. '
          + 'Бұрыштық орынға фасад керек болса — «Фронтальная панель» қолданыңыз: '
          + 'корпус тікбұрыш күйінде қалады да, фасад қалыпты жұмыс істейді',
        )
      }
      if (section.contents.some((c) => c.kind === 'drawers')) {
        throw new ConfigValidationError(
          `sections[${i}].contents`, 'ящики',
          'қиғаш корпуста направляющая әзірге жасалмайды. '
          + 'Бұрыштық орынға ящик керек болса — «Фронтальная панель» қолданыңыз',
        )
      }
    }

    /*
     * K10 / audit C8 (docs/audit/corner-2026-09-20.md §C8): осы бестен
     * трапецияны МҮЛДЕ БІЛМЕЙТІН детальдар. Дұрыс саны (қанша шегіну, қиғаш
     * жиекке қалай жабысу, неше аяқ жеткілікті) — цехтың/дизайнның шешімі
     * (drilling-fix-plan.md-тегі «B тобы»), кодтан ойдан шығарылмайды.
     * Нақты генерацияда тексерілді (аяқ): дноның 4 тесігінің 4-і де ауада
     * қалады, себебі `legScrewHoles` тереңдікті ТҰРАҚТЫ деп есептейді.
     */
    if (config.base?.kind === 'legs') {
      throw new ConfigValidationError(
        'base.kind', 'legs',
        'бұрыштық корпуста реттелетін аяқ әзірге жасалмайды: дноның тесігі '
        + 'қиғаш кесілген аймаққа түсіп кетуі мүмкін (ауада тұрған бұранда). '
        + 'Цоколь («plinth», box ЕМЕС «front» пішінде) қолданыңыз',
      )
    }
    /*
     * K10b / audit C8: цоколь-КОРОБ (`plinthShape: 'box'`) бүйір
     * тақтайлары номиналды тереңдіктен (D) есептеледі (`boxDepth`,
     * generateCabinet.ts төменде), корпустың Х-қа тәуелді трапеция
     * тереңдігін БІЛМЕЙДІ. Нақты сан (600/350): оң жақтағы тақтай қиғаштың
     * алдынан 184 мм шығып тұрады. Тек ЖАЛПАҚ («front») пішін — алдыңғы
     * жиектегі жалғыз тақта, тереңдікке кірмейді — қауіпсіз, ӘСЕР ЕТПЕЙДІ.
     */
    if (config.base?.kind === 'plinth' && config.base.plinthShape === 'box') {
      throw new ConfigValidationError(
        'base.plinthShape', 'box',
        'бұрыштық корпуста цоколь-короб әзірге жасалмайды: бүйір тақтайлары '
        + 'номиналды тереңдіктен (D) есептеледі, оң жақта қиғаштың алдынан '
        + 'шығып тұрады. «front» пішінін қолданыңыз (тек алдыңғы тақта)',
      )
    }
    /*
     * K10c / audit C8: жеке (ортақ емес) столешница тікбұрыш болып шығады
     * (`W + 2·overhangSides` × `D + overhangFront`), трапецияны мүлде
     * білмейді — қиғаш алдыңғы жиектен 250 мм-ге дейін шығып тұрады. Дұрыс
     * пішін (кесілген бұрыш па, өз радиусы ма) — цехтың/дизайнның шешімі,
     * нақты кухня қатарларында worktop.shared=true арқылы бөлек
     * есептеледі (worktopParts, generateCabinet-тен ТЫС) — сол режимге
     * бұл тыйым мүлде ТИМЕЙДІ.
     */
    if (config.worktop && !config.worktop.shared) {
      throw new ConfigValidationError(
        'worktop', 'есть',
        'бұрыштық корпуста жеке (ортақ емес) столешница әзірге жасалмайды: '
        + 'ол тікбұрыш болып шығады, қиғаш алдыңғы жиектен шығып тұрады. '
        + 'worktop.shared = true қойыңыз — қатардың ортақ тақтасы бөлек есептеледі',
      )
    }
    /*
     * K10d / audit C8: планка (topRails) тұрақты z-терезеде (мыс.
     * z=0..100) тұрады, х-қа тәуелді трапецияны білмейді. Нақты сан
     * (600/350): қиғаш аймақта (материал шегі ~250 мм-ге дейін артқа
     * шегінеді) планканың z-терезесінің астында МАТЕРИАЛ МҮЛДЕ ЖОҚ —
     * жай ғана «ұзын шеті ілінеді» емес, толықтай ауада. Дұрыс шешім
     * (диагональ кесу, екі бөлек тереңдік) — өндіріс шешімі.
     */
    if (config.topRails) {
      throw new ConfigValidationError(
        'topRails', 'есть',
        'бұрыштық корпуста планка (топ-рейл) әзірге жасалмайды: планка '
        + 'тұрақты тереңдікте, ал қиғаш аймақта астында материал мүлде жоқ '
        + 'болуы мүмкін — тұтас крыша (topRails берілмесе) қолданыңыз',
      )
    }
    /*
     * K10e / audit C8: фронтальдық панель тұрақты z-де тұрады (`z:
     * -panelMat.thickness`), ал корпустың нақты алды қиғаш бойынша артқа
     * кетеді. Нақты сан (600/350, side='right', width=200): панель
     * z=-16..0-де, ал сол жерде (х=400..600) корпустың нақты алды
     * z≈167..250 — панель мен корпустың арасында СЫРТ АУА, панель
     * ешнәрсеге ілінбейді («ауада қалқып тұр»). kitchen.ts-те бұл
     * тіркесім (frontPanel БАР cornerSink кабинетінде `corner` өрісі
     * мүлде орнатылмайды) ешқашан кездеспейді — қате лақтыру қауіпсіз.
     */
    if (config.frontPanel) {
      throw new ConfigValidationError(
        'frontPanel', 'есть',
        'бұрыштық корпуста фронтальдық панель әзірге жасалмайды: панель '
        + 'тұрақты z-де тұрады, ал корпустың нақты алды қиғаш бойынша артқа '
        + 'кетеді — панель ауада қалқып қалады',
      )
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
   * K10f / audit C8 (docs/audit/corner-2026-09-20.md §C8): бұрыштық корпуста
   * берілген Х (сол→оң) нүктесіндегі НАҚТЫ сөре тереңдігі.
   *
   * `stand` (жолақ ішіндегі тік стойка) бір ғана Х нүктесінде тұрады, сол
   * себепті оған `widthBevel` СЫЙМАЙДЫ (ол екі ұшы бар детальге арналған) —
   * оның орнына сол нүктедегі ЖАЛҒЫЗ тереңдік санын білу жеткілікті.
   *
   * Шеткі мәндер `bottom`/`top`-тың өз bevel-імен ДӘЛ СӘЙКЕС келеді: х = t
   * (ішкі кеңістіктің сол шеті, `bottom.position.x`) — `shelfDepth`, х = W − t
   * (оң шеті, `bottom.position.x + bottom.finishedLength`) — `shelfDepthRight`.
   * Аралығында — СЫЗЫҚТЫҚ интерполяция (трапеция қиғашы да сызықтық).
   */
  const depthAtX = (x: number): { z: number; depth: number } => {
    if (!corner) return { z: settings.shelfSetback, depth: shelfDepth }
    const ratio = innerWidth > 0 ? Math.min(1, Math.max(0, (x - t) / innerWidth)) : 0
    const depth = shelfDepth + (shelfDepthRight - shelfDepth) * ratio
    return { z: carcassDepth - depth, depth }
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
    edgesOverride?: PanelEdges,
  ): Panel => {
    const edges = edgesOverride ?? resolveEdges(role, config.construction, config.edging, orientation)
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
      cutouts: [],
      grooves: [],
      milling: [],
    }
  }

  // ── Корпус (§4.4) ──────────────────────────────────────────────────────────
  const sidesOverlay = config.construction === 'sidesOverlay'
  /**
   * Бекітілуді шешу: `mounts` берілмесе, ЕСКІ `construction`-нан шығады.
   * Сондықтан бұрын сақталған жоба дәл сол панельдерді береді (§8.7 эталоны
   * соны күзетеді).
   */
  const defaultMount: PanelMount = sidesOverlay ? 'inset' : 'overlay'
  const topMount: PanelMount = config.mounts?.top ?? defaultMount
  const bottomMount: PanelMount = config.mounts?.bottom ?? defaultMount
  /**
   * Қиғашта бүйір — ТРАПЕЦИЯ. Өлшемі (заготовка) бұрынғыдай H × тереңдік:
   * станок алдымен тікбұрышты кеседі, содан кейін қиғашты кеседі.
   */
  const heightFront = heightAtDepth(0)
  const heightBack = heightAtDepth(carcassDepth)
  const sideBevel = slope ? { lengthAtStart: heightFront, lengthAtEnd: heightBack } : undefined
  const sideNote = slope ? `Скос ${heightFront} → ${heightBack} мм` : ''

  /*
   * ── Бекітілу (§4.4, элемент бойынша) ──────────────────────────────────────
   *
   * Крышка мен дно бір-бірінен ТӘУЕЛСІЗ бекітіледі, әрі әр панель бүйірлерді
   * бөлек-бөлек жабуы мүмкін. Осыдан үш нәрсе шығады:
   *   1. Көлденең панельдің ені: жапқан бүйірінің әрқайсысына +t;
   *   2. Бүйірдің биіктігі: оны жапқан панельдің әрқайсысына −t;
   *   3. Торцтардың көрінуі: жабылған торц ЖАСЫРЫН, ашығы КӨРІНЕДІ.
   * Үшеуі де бір жерден шығады, сондықтан олар ажырап кете алмайды.
   */
  const covers = (mount: PanelMount, side: 'left' | 'right'): boolean =>
    mount === 'overlay' || (side === 'left' ? mount === 'overlayLeft' : mount === 'overlayRight')

  const horizontalSpan = (mount: PanelMount): { x: number; length: number } => {
    const left = covers(mount, 'left')
    const right = covers(mount, 'right')
    return { x: left ? 0 : t, length: innerWidth + (left ? t : 0) + (right ? t : 0) }
  }

  /** Бүйірдің биіктігі мен бастауы: оны жапқан панель қысқартады. */
  const sideSpan = (side: 'left' | 'right'): { y: number; length: number } => {
    const below = covers(bottomMount, side) ? t : 0
    const above = covers(topMount, side) ? t : 0
    return { y: below, length: H - below - above }
  }

  /** Бүйірдің торцы: жабылмаған жағы КӨРІНЕДІ (W1 — асты, W2 — үсті). */
  const sideEdges = (side: 'left' | 'right') =>
    carcassEdges({ W1: !covers(bottomMount, side), W2: !covers(topMount, side) }, config.edging)

  /** Көлденең панельдің торцы: жапқан жағы СЫРТҚА шығады да, көрінеді. */
  const horizontalEdges = (mount: PanelMount) =>
    carcassEdges({ W1: covers(mount, 'left'), W2: covers(mount, 'right') }, config.edging)

  const leftSpan = sideSpan('left')
  const sideLeft = make(
    'side-left', 'side', 'Боковина', carcass, leftSpan.length, carcassDepth,
    { x: 0, y: leftSpan.y, z: 0 }, ORIENT_SIDE, sideNote, sideEdges('left'),
  )
  // Бұрыштық корпуста оң бүйір ТАРЫРАҚ: ол өз тереңдігінде тұрады да,
  // қабырғаға тірелу үшін артқа жылжиды.
  const rightZ = corner ? carcassDepth - carcassDepthRight : 0
  const rightNote = corner ? `Глубина ${carcassDepthRight} мм` : sideNote
  const rightSpan = sideSpan('right')
  const sideRight = make(
    'side-right', 'side', 'Боковина', carcass, rightSpan.length, carcassDepthRight,
    { x: W - t, y: rightSpan.y, z: rightZ }, ORIENT_SIDE, rightNote, sideEdges('right'),
  )
  if (sideBevel) {
    sideLeft.bevel = { ...sideBevel }
    sideRight.bevel = { ...sideBevel }
  }
  const bottomSpan = horizontalSpan(bottomMount)
  const bottom = make(
    'bottom', 'bottom', 'Дно', carcass, bottomSpan.length, carcassDepth,
    { x: bottomSpan.x, y: 0, z: 0 }, ORIENT_HORIZONTAL, '', horizontalEdges(bottomMount),
  )
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

  const topSpan = horizontalSpan(topMount)
  const top = make(
    'top', 'top', 'Крышка', carcass, topSpan.length, slope ? topWidth : carcassDepth,
    // Көлбеу крышкада қалыңдық ТӨМЕН қарай кетеді (жатық панельдің
    // келісімі), сондықтан бастауы дәл биік жиектің деңгейінде.
    { x: topSpan.x, y: slope ? heightFront : H - t, z: 0 }, ORIENT_HORIZONTAL,
    slope ? `Наклонная, ${Math.round((slopeAngle * 180) / Math.PI)}°` : '',
    horizontalEdges(topMount),
  )
  if (slope) {
    // Көлбеуді 3D оқиды: панель өз жазықтығында тікбұрыш күйінде қалады.
    top.rotation = { ...top.rotation, x: top.rotation.x + (slopeAngle * 180) / Math.PI }
  }
  if (cornerBevel) top.bevel = { ...cornerBevel }

  /*
   * ── Крыша: панель, ПЛАНКА немесе жоқ ──────────────────────────────────────
   *
   * `top` панелі ҮШ жағдайда да есептеледі, себебі одан ішкі биіктік шығады,
   * ал оған сөре де, фасад та, ящик те сүйенеді. Тізімге не түсетіні ғана
   * өзгереді. `topParts` — крышаның ОРНЫНДА не тұрғаны: присадка да,
   * паз да соған қарайды, сондықтан жоқ детальға тесік бұрғыланбайды.
   */
  const topParts: Panel[] = []
  if (config.topRails) {
    const rails = config.topRails
    const upright = rails.orientation === 'edge'
    const railWidth = rails.width
    if (!Number.isInteger(railWidth) || railWidth < MIN_RAIL_WIDTH || railWidth > carcassDepth) {
      throw new ConfigValidationError(
        'topRails.width', `${railWidth} мм`,
        `${MIN_RAIL_WIDTH}..${carcassDepth} мм, бүтін сан`,
      )
    }
    // Екі планка бір-біріне тимеуі керек: әйтпесе бұл жай ғана тұтас крыша.
    if (rails.count === 2 && 2 * railWidth > carcassDepth) {
      throw new ConfigValidationError(
        'topRails.width', `${railWidth} мм × 2`, `≤ ${carcassDepth} мм (глубина корпуса)`,
      )
    }
    // Жатық планка крышаның ОРНЫНА жатады; тік планка сол деңгейден ТӨМЕН кетеді.
    const y = upright ? H - railWidth : H - t
    const positions: { id: string; label: string; z: number }[] = rails.count === 2
      ? [
        { id: 'top-rail-front', label: 'Планка верхняя передняя', z: 0 },
        {
          id: 'top-rail-back',
          label: 'Планка верхняя задняя',
          z: carcassDepth - (upright ? t : railWidth),
        },
      ]
      : [{
        id: 'top-rail-back',
        label: 'Планка верхняя задняя',
        z: carcassDepth - (upright ? t : railWidth),
      }]

    for (const { id, label, z } of positions) {
      topParts.push(make(
        id, 'rail', label, carcass, topSpan.length, railWidth,
        { x: topSpan.x, y, z }, upright ? ORIENT_UPRIGHT : ORIENT_HORIZONTAL,
        upright ? 'Царга на ребро' : 'Царга плашмя',
        horizontalEdges(topMount),
      ))
    }
  } else if (!config.openTop) {
    topParts.push(top)
  }

  // Рет деталировкадағы жолдардың ретін анықтайды: сыртта тұрған деталь
  // бірінші жазылады. Бүйір ТОЛЫҚ биіктікте болса (ештеңе жаппаса) — ол
  // корпустың сырты, сондықтан алдымен келеді.
  const sidesOutside = leftSpan.length === H && rightSpan.length === H
  if (sidesOutside) {
    panels.push(sideLeft, sideRight, bottom, ...topParts)
  } else {
    panels.push(bottom, ...topParts, sideLeft, sideRight)
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

  /*
   * ── ФРОНТАЛЬДЫҚ ПАНЕЛЬ ────────────────────────────────────────────────────
   *
   * Алдыңғы жиектің бір бөлігін ТІК панель жабады да, фасад қалған ұяға
   * қойылады (бұрыштық орында көрші модульдің тұтқасына соғылмау үшін).
   *
   * Корпус ТІКБҰРЫШ күйінде қалады — сондықтан мұнда тарылатыны тек ҰЯ:
   * ішкі геометрия да, сөре де, перегородка да тиылмайды. Ящик те тарылады,
   * әйтпесе ол шығарылғанда панельге соғылар еді.
   */
  const frontPanel = config.frontPanel
  if (frontPanel) {
    const outer = frontPanel.side === 'left' ? 0 : slots.length - 1
    const slot = slots[outer]
    if (!Number.isInteger(frontPanel.width) || frontPanel.width < MIN_RAIL_WIDTH) {
      throw new ConfigValidationError(
        'frontPanel.width', `${frontPanel.width} мм`, `≥ ${MIN_RAIL_WIDTH} мм, бүтін сан`,
      )
    }
    if (!slot || slot.width - frontPanel.width < MIN_FRONT_WIDTH) {
      throw new ConfigValidationError(
        'frontPanel.width', `${frontPanel.width} мм`,
        `фасадқа ${MIN_FRONT_WIDTH} мм-ден кем қалмауы керек`,
      )
    }
    // Ұя тарылады: сол жақта бастауы жылжиды, оң жақта тек ені кемиді.
    if (frontPanel.side === 'left') slot.x += frontPanel.width
    slot.width -= frontPanel.width
  }

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
  /** Ящик фасадтары мен олардың тұтқасы — присадка кезеңінде бұрғыланады. */
  const drawerHandles: { fronts: Panel[]; spec: HandleSpec | null | undefined; field: string }[] = []

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
        const field = `sections[${sectionIndex}].contents[${bandIndex}]`

        /*
         * Шегіністер. Цехтың `shelfGap`-ы — отырғызу саңылауы (§4.6), ал бұл
         * ӘДЕЙІ шегініс: бүйірдегі бөлгіштен, алдыңғы механизмнен қашықтау.
         * Екеуі қосылады, себебі екеуінің себебі бөлек.
         */
        const insets = content.insets ?? {}
        for (const [name, value] of Object.entries(insets)) {
          if (value === undefined) continue
          if (!Number.isInteger(value) || value < 0 || value > 1000) {
            throw new ConfigValidationError(`${field}.insets.${name}`, `${value}`, '0..1000 мм, бүтін сан')
          }
        }
        const insetLeft = insets.left ?? 0
        const insetRight = insets.right ?? 0
        const insetFront = insets.front ?? 0
        const insetBack = insets.back ?? 0

        /*
         * Биіктіктер. `at` берілсе — цех қойған нақты сандар; әйтпесе ішкі
         * саңылау тең бөлінеді де, қалдық миллиметр АСТЫҢҒЫ бөліктерден
         * бастап таратылады (көз деңгейінен төмен жер аз көрінеді).
         */
        const explicit = content.at
        if (explicit) {
          if (explicit.length === 0) {
            throw new ConfigValidationError(`${field}.at`, 'бос тізім', 'кемінде бір биіктік')
          }
          let previous = -Infinity
          for (const value of explicit) {
            if (!Number.isInteger(value) || value < 0) {
              throw new ConfigValidationError(`${field}.at`, `${value}`, '0-ден басталатын бүтін сан, мм')
            }
            if (value + t > band.height) {
              throw new ConfigValidationError(
                `${field}.at`, `${value} мм`, `0..${band.height - t} мм (жолақтың биіктігі ${band.height})`,
              )
            }
            // Реті бұзылса, сөрелер бір-біріне кіріп кетеді — үнсіз түзетпейміз.
            if (value < previous + t) {
              throw new ConfigValidationError(
                `${field}.at`, `${value} мм`, `алдыңғы сөреден кемінде ${t} мм жоғары`,
              )
            }
            previous = value
          }
        }

        const openings = distributeMillimetres(band.height - content.count * t, content.count + 1)
        const note = content.shelfKind === 'fixed'
          ? 'Фиксированная, конфирмат'
          : 'На полкодержателях, шаг 32 мм'

        const shelfCount = explicit ? explicit.length : content.count
        let y = band.y
        for (let i = 0; i < shelfCount; i += 1) {
          y = explicit ? band.y + explicit[i]! : y + (openings[i] ?? 0)
          const space = shelfSpaceAt(y + t)
          if (space.depth < MIN_DIMENSION) {
            throw new ConfigValidationError(
              `sections[${sectionIndex}].contents[${bandIndex}].count`,
              `полка на высоте ${y} мм упирается в скос: остаётся ${space.depth} мм глубины`,
              'уменьшите число полок или поднимите низкую сторону',
            )
          }
          const shelfWidth = layout.width - settings.shelfGap - insetLeft - insetRight
          const shelfDepthHere = space.depth - insetFront - insetBack
          if (shelfWidth < MIN_RAIL_WIDTH || shelfDepthHere < MIN_RAIL_WIDTH) {
            throw new ConfigValidationError(
              `${field}.insets`,
              `отступы оставляют полку ${shelfWidth}×${shelfDepthHere} мм`,
              `каждая сторона ≥ ${MIN_RAIL_WIDTH} мм`,
            )
          }
          const shelfNote = [
            space.depth < shelfDepth ? `${note}. Укорочена под скос` : note,
            insetLeft || insetRight || insetFront || insetBack ? 'С отступами' : '',
          ].filter(Boolean).join('. ')
          const shelf = make(
            `${section.id}${bandTag(bandIndex)}-shelf-${i + 1}`, 'shelf', 'Полка', carcass,
            shelfWidth, shelfDepthHere,
            {
              x: layout.x + Math.floor(settings.shelfGap / 2) + insetLeft,
              y,
              z: space.z + insetFront,
            },
            ORIENT_HORIZONTAL,
            shelfNote,
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

      if (content.kind === 'stand' && content.count > 0) {
        const field = `sections[${sectionIndex}].contents[${bandIndex}]`
        if (!Number.isInteger(content.count) || content.count < 1 || content.count > 10) {
          throw new ConfigValidationError(`${field}.count`, `${content.count}`, '1..10 бүтін сан')
        }

        const insets = content.insets ?? {}
        for (const [name, value] of Object.entries(insets)) {
          if (value === undefined) continue
          if (!Number.isInteger(value) || value < 0 || value > 1000) {
            throw new ConfigValidationError(`${field}.insets.${name}`, `${value}`, '0..1000 мм, бүтін сан')
          }
        }
        const top = insets.top ?? 0
        const bottom = insets.bottom ?? 0
        const front = insets.front ?? 0
        const back = insets.back ?? 0

        const standHeight = band.height - top - bottom
        if (standHeight < MIN_RAIL_WIDTH) {
          throw new ConfigValidationError(
            `${field}.insets`,
            `отступы оставляют стойку биіктігі ${standHeight} мм`,
            `биіктік ≥ ${MIN_RAIL_WIDTH} мм`,
          )
        }

        /*
         * Орындары: нақты берілсе — сол, әйтпесе ұяның ені тең бөлінеді
         * (сөренің ережесімен бір: қалдық миллиметр СОЛ жақтан таратылады).
         */
        const explicit = content.at
        if (explicit) {
          let previous = -Infinity
          for (const value of explicit) {
            if (!Number.isInteger(value) || value < 0) {
              throw new ConfigValidationError(`${field}.at`, `${value}`, '0-ден басталатын бүтін сан, мм')
            }
            if (value + t > layout.width) {
              throw new ConfigValidationError(
                `${field}.at`, `${value} мм`, `0..${layout.width - t} мм (ұяның ені ${layout.width})`,
              )
            }
            if (value < previous + t) {
              throw new ConfigValidationError(
                `${field}.at`, `${value} мм`, `алдыңғы стойкадан кемінде ${t} мм оңға`,
              )
            }
            previous = value
          }
        }

        const openings = distributeMillimetres(layout.width - content.count * t, content.count + 1)
        const standCount = explicit ? explicit.length : content.count
        let x = layout.x
        for (let i = 0; i < standCount; i += 1) {
          x = explicit ? layout.x + explicit[i]! : x + (openings[i] ?? 0)
          /*
           * K10f / audit C8: тереңдік осы стойканың ӨЗ Х нүктесінен алынады
           * (стойканың ортасы, `x + t/2`) — жолақтың ортасынан ЕМЕС. Бұрыштық
           * корпуста сол жақ стойка терең жерде, оң жақ стойка қиғаш жерде
           * тұрады: екеуінің тереңдігі бірдей болуы МҮМКІН ЕМЕС.
           * Бұрыштық емес корпуста (не slope-та) — бұрынғыдай, х-тен тәуелсіз.
           */
          const space = corner ? depthAtX(x + Math.round(t / 2)) : shelfSpaceAt(band.y + Math.round(band.height / 2))
          const standDepth = space.depth - front - back
          if (standDepth < MIN_RAIL_WIDTH) {
            throw new ConfigValidationError(
              `${field}.insets`,
              `отступы (х=${x} мм-де) стойка тереңдігін ${standDepth} мм-ге дейін қысады`,
              `тереңдік ≥ ${MIN_RAIL_WIDTH} мм`,
            )
          }
          panels.push(make(
            `${section.id}${bandTag(bandIndex)}-stand-${i + 1}`, 'divider', 'Стойка', carcass,
            standHeight, standDepth,
            { x, y: band.y + bottom, z: space.z + front },
            ORIENT_SIDE,
            'Стойка в полосе',
          ))
          if (!explicit) x += t
        }
        return
      }

      if (content.kind === 'appliance') {
        /*
         * G3 (docs/visual/generator-gaps.md). Техника ҰЯСЫНЫҢ өз панелі жоқ
         * (жоғарыдағы «Техниканың ҰЯСЫ» түсіндірмесі), бірақ секцияда одан
         * ЖОҒАРЫ жолақ (сөре) болса, соны жабатын ілмелі фасад техниканың
         * ҮСТІНЕН басталуы керек — әйтпесе фасад техниканың өзін де жауып,
         * есігіне кедергі жасайды. Ереже ящиктікімен БІРДЕЙ (жоғарыдағы
         * §D1), тек панель шықпайды: тек шек жылжиды.
         */
        hingedFrontFrom[sectionIndex] = Math.max(
          hingedFrontFrom[sectionIndex] ?? t,
          band.y + band.height + t,
        )
        return
      }

      if (content.kind === 'drawers') {
        const created = makeDrawers({
          section, sectionIndex, bandIndex, band, layout,
          slot: slots[sectionIndex] ?? { x: layout.x, width: layout.width },
          settings, carcass, frontMat, backMat, shelfDepth, make,
          system: drawerSystem,
          metalBox,
          metalBoxBackHeight: config.metalBoxBackHeight,
          // Фронтальдық панель ұяны тарылтады: ящик шығарылғанда оған
          // соғылмауы керек. Ол тек СОЛ секцияға тиеді.
          openingInset: frontPanel && (
            frontPanel.side === 'left' ? sectionIndex === 0 : sectionIndex === layouts.length - 1
          )
            ? { side: frontPanel.side, width: frontPanel.width }
            : null,
        })
        panels.push(...created.panels)
        for (const run of created.runs) {
          drawerRuns.push({ ...run, sectionIndex })
        }
        drawerHandles.push({
          fronts: created.panels.filter((p) => p.role === 'front'),
          spec: content.handle,
          field: `sections[${sectionIndex}].contents[${bandIndex}].handle.handleId`,
        })
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
  } else if (isInsetBack) {
    /*
     * ВКЛАДНОЙ: ХДФ корпустың ішкі ойығына дәл кіреді де, панельдердің
     * торцына бекітіледі. Пазы ЖОҚ, сондықтан өлшемі — таза ойық, ал орны
     * арт жиектен `inset` шегініп тұрады.
     */
    panels.push(
      make(
        'back', 'back', 'Задняя стенка', backMat,
        innerHeight, innerWidth,
        { x: t, y: t, z: D - backInset - backMat.thickness },
        ORIENT_FACING,
        backInset > 0 ? `Вкладная, отступ ${backInset} мм` : 'Вкладная, заподлицо',
      ),
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
    /*
     * ⚠ ҚИҒАШ ТӨБЕ. Фасад корпустың АЛДЫНДА тұрады, ал қиғаш корпуста
     * алдыңғы жиектің биіктігі `H`-тен өзгеше: алға қарай төмендейтін
     * төбеде ол әлдеқайда аласа. Бұрын мұнда `H` тұрған да, 2000 мм
     * корпустың алды 1200 мм болса, фасад 800 мм-ге ауада қалып қоятын.
     *
     * Артқа қарай төмендейтін төбеде алды биік, сондықтан `H`-пен бірдей —
     * ескі жобаның фасады өзгермейді.
     */
    const frontTop = heightAtDepth(0)
    // Вкладной фасад крышканың АСТЫНА кіреді, сондықтан бір қалыңдық кемиді.
    const spanY = frontTop - originY - (inset ? t : 0)

    /*
     * Көтерілетін фасад ұяда ЖАЛҒЫЗ болады: екеуін қатар қою механизмнің
     * иінтірегін бір-біріне соқтырады, ал ол тек құрастыру кезінде байқалады.
     */
    if (fronts.opening === 'up' && fronts.count > 1) {
      throw new ConfigValidationError(
        `sections[${sectionIndex}].fronts.count`, `${fronts.count}`,
        'подъёмный фасад в нише может быть только один',
      )
    }

    // Секцияның ӨЗ фасад декоры болса — соны, әйтпесе корпустікі.
    const secFrontMat = fronts.materialId
      ? requireMaterial(materials, fronts.materialId, `sections[${sectionIndex}].fronts.materialId`)
      : frontMat
    const created = makeFronts(
      layout.section, sectionIndex, fronts, slot,
      spanY, originY,
      inset ? 0 : -secFrontMat.thickness,
      secFrontMat, settings, make,
    )
    panels.push(...created)
    frontGroups.push({ fronts: created, sectionIndex })
  })

  // ── Фронтальдық панель ─────────────────────────────────────────────────────
  if (frontPanel) {
    // Панель КӨРІНЕДІ, сондықтан әдепкі материалы — фасадтікі, әрі ол
    // фасадпен БІР жазықтықта тұрады.
    const panelMat = frontPanel.materialId
      ? requireMaterial(materials, frontPanel.materialId, 'frontPanel.materialId')
      : frontMat
    panels.push(make(
      'front-panel', 'front', 'Фронтальная панель', panelMat,
      heightAtDepth(0), frontPanel.width,
      {
        x: frontPanel.side === 'left' ? 0 : W - frontPanel.width,
        // K5 / audit C3: y ЕМЕС baseHeight — make() позицияны ӨЗІ
        // baseHeight-ке көтереді (`raised`, жоғарыда). Мұнда тағы бір рет
        // қоссақ, панель цоколь биіктігіне ЕКІ РЕТ көтеріліп, столешницадан
        // асып шығады.
        y: 0,
        z: -panelMat.thickness,
      },
      ORIENT_FACING,
      `Фронтальная панель, ${frontPanel.side === 'left' ? 'слева' : 'справа'}`,
    ))
  }

  /*
   * ── Фронтальдық панельдің СТОЙКАСЫ ──────────────────────────────────────
   *
   * K6 / audit C4 (docs/audit/corner-2026-09-20.md §C4). Соқыр (накладной)
   * фронтальдық панель — тек фасадпен бір жазықтықтағы КӨРІНІС, оның
   * артында КОРПУС панелі жоқ (корпус ТІКБҰРЫШ күйінде қалады, §558-575).
   * Сондықтан есіктің ілгек планкасын ілетін ештеңе болмайды: `side-left`/
   * `side-right` есіктен 500+ мм қашық тұр (нақты санды осы тесттің
   * есебінде қара).
   *
   * Нағыз жиһазда дәл осы жерге — соқыр панельдің артына — ТІК СТОЙКА
   * қойылады, есік соған ілінеді. Ол `divider`-мен БІРДЕЙ рөл алады: екі
   * жағы да жасырын, алдыңғы жиегі (L1) көрінеді (`edges.ts` `case
   * 'divider'`), корпустың толық тереңдігінде тұрады, дно мен крышкаға
   * конфирматпен бекітіледі — дәл секциялар арасындағы перегородка сияқты.
   */
  let frontPanelStand: Panel | null = null
  if (frontPanel) {
    const standX = frontPanel.side === 'left' ? frontPanel.width : W - frontPanel.width - t
    frontPanelStand = make(
      'front-panel-stand', 'divider', 'Стойка', carcass,
      innerHeight, carcassDepth, { x: standX, y: t, z: 0 }, ORIENT_SIDE,
      'Стойка фронтальной панели — ілгек планкасы осыған ілінеді',
    )
    panels.push(frontPanelStand)
  }

  // ── Цоколь мен столешница ──────────────────────────────────────────────────
  /** Цоколь ҚОРАП болса — оның буынының түрі; әйтпесе `null`. */
  let plinthBox: 'confirmat' | 'minifix' | null = null
  if (config.base?.kind === 'plinth') {
    // Цоколь — КӨРІНЕТІН деталь: көбіне фасадпен бір түсте болады.
    const plinthMat = config.base.plinthMaterialId
      ? requireMaterial(materials, config.base.plinthMaterialId, 'base.plinthMaterialId')
      : carcass
    // Цоколь алдыңғы жиектен ішке шегіндіріледі: аяқ тұратын орын.
    const boxJoint = config.base.plinthJoint ?? 'confirmat'

    /*
     * ОРТАҚ цоколь (G2 — docs/visual/generator-gaps.md §G2, диагноз
     * docs/audit/qdesign-drilling-reference.md §7). `kitchen.ts`-тегі
     * `mergeSharedPlinths` көрші модульдердің цокольін `base.shared`-пен
     * белгілейді: топтың БАСЫНДА (`base.sharedSpan` бар) БІР ұзын панель,
     * қалған мүшелерде («shared» ғана) — меншікті панелі МҮЛДЕ жоқ.
     * «box» ешқашан бірікпейді (бүйір/арт тақтайлары бар) — қате конфиг.
     */
    if (config.base.shared && config.base.plinthShape === 'box') {
      throw new ConfigValidationError(
        'base.shared', 'true',
        '«box» пішінді цоколь ортақ жолаққа бірікпейді: бүйір/арт тақтайлары бар, '
        + 'тұтас жолаққа сыймайды. Ортақ жолаққа тек «front» пішінін қолданыңыз',
      )
    }

    if (!config.base.shared) {
      panels.push(
        make(
          'plinth', 'plinth', 'Цоколь', plinthMat,
          W, baseHeight,
          // ⚠ 2026-09-20 түзетілді (docs/audit/drilling-2026-09-20.md §R1):
          // бұрын мұнда ORIENT_FACING тұратын, ол ұзындықты (900 мм, W) БИІКТІККЕ
          // (world y) түсіретін. Цоколь — «на ребро» тұрған КӨЛДЕНЕҢ планка:
          // ұзындығы солдан оңға (world x), ені (baseHeight) жоғары қарайды
          // (world y). Дәл сол қатенің салдары: присадка панельден тыс шығатын
          // (мыс. y = 890 мм, 93 мм тақтайда). `make()` `y`-ге baseHeight
          // қосатындықтан (жоғарыдағы `raised`), позиция ӨЗГЕРМЕЙДІ.
          { x: 0, y: -baseHeight, z: settings.plinthSetback }, ORIENT_UPRIGHT,
          // Конфирматтың басы КӨРІНЕТІН бетке шығады — цех оны заглушкамен
          // жабады. Мұны деталировкада айтпасақ, ол құрастыруда ғана байқалады.
          config.base.plinthShape === 'box' && boxJoint === 'confirmat'
            ? 'Цоколь, лицевой; шляпки конфирматов на лице — заглушки'
            : 'Цоколь, лицевой',
        ),
      )

      /*
       * ЖАБЫҚ ҚОРАП (qdesign: «накладной короб»).
       *
       * Алды мен арты — ТОЛЫҚ ені, ал бүйірлері екеуінің АРАСЫНА кіреді.
       * Дәл осылай: бәсекелестің сол өлшемдегі модулінен өлшенді (2026-09-04),
       * әрі бұл цехта да қисынды — көрінетін алдыңғы планканың торцы бүйірмен
       * жабылмайды, ал жинағанда қорап тікбұрышты болып шығады.
       *
       * Шегініс тек АЛДЫНДА: арт жағы қабырғаға тіреледі, оны шегіндірудің
       * мағынасы жоқ әрі жүк түсетін тірек ауданы азаяр еді.
       */
      if (config.base.plinthShape === 'box') {
        const pt = plinthMat.thickness
        const boxDepth = D - settings.plinthSetback - 2 * pt
        if (boxDepth < MIN_DIMENSION) {
          throw new ConfigValidationError(
            'base.plinthShape', `просвет короба ${boxDepth} мм`, `≥ ${MIN_DIMENSION} мм`,
          )
        }
        panels.push(
          make(
            'plinth-back', 'plinth', 'Цоколь задний', plinthMat,
            W, baseHeight,
            // ⚠ 2026-09-20: жоғарыдағы `plinth`-пен бірдей себеп — §R1.
            { x: 0, y: -baseHeight, z: D - pt }, ORIENT_UPRIGHT,
            'Цоколь, задний',
            // Арт тақтайды ешкім көрмейді — кромка ақшаны бос жейді.
            { L1: null, L2: null, W1: null, W2: null },
          ),
        )
        for (const side of ['left', 'right'] as const) {
          panels.push(
            make(
              `plinth-${side}`, 'plinth', `Цоколь боковой ${side === 'left' ? 'левый' : 'правый'}`,
              plinthMat,
              baseHeight, boxDepth,
              {
                x: side === 'left' ? 0 : W - pt,
                y: -baseHeight,
                z: settings.plinthSetback + pt,
              },
              ORIENT_SIDE,
              `Цоколь, ${side === 'left' ? 'левый' : 'правый'}`,
            ),
          )
        }
        plinthBox = boxJoint
      }
    } else if (config.base.sharedSpan) {
      // Топтың БАСЫ: бір ORIENT_UPRIGHT панель, ұзындығы — бүкіл топтың
      // қосындысы («plinth» id-і бұрынғыдай — не жеке, не ортақ, ешқашан
      // екеуі бірге болмайды).
      panels.push(
        make(
          'plinth', 'plinth', 'Цоколь (объединённый)', plinthMat,
          config.base.sharedSpan, baseHeight,
          { x: 0, y: -baseHeight, z: settings.plinthSetback }, ORIENT_UPRIGHT,
          'Цоколь, лицевой, объединённый — қатардың бір жолағы (G2, qdesign)',
        ),
      )
    }
    // else: shared === true, sharedSpan жоқ — топтың басы емес, меншікті панелі жоқ.
  }

  // Ортақ столешница — қатардың бір тақтасы (ерікті деталь), корпуста жоқ.
  if (config.worktop && !config.worktop.shared) {
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
        // K5 / audit C3: y ЕМЕС baseHeight — make() позицияны ӨЗІ
        // baseHeight-ке көтереді, мұнда тағы бір рет қоссақ, екі есе шығады.
        { x, y: 0, z: -mat.thickness }, ORIENT_FACING,
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
    const grooved = [sideLeft, sideRight, bottom, ...topParts, ...dividers]
    // K6: стойка да корпустың толық тереңдігінде тұрады — паз соған да түседі.
    if (frontPanelStand) grooved.push(frontPanelStand)
    for (const panel of grooved) {
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
  // ⚠ ЖОҚ детальға тесік бұрғыланбайды: үсті ашық корпуста бүйірдің торцінде
  // «крышканың» саңылаулары қалып қойса, цех оны құрастыру кезінде ғана
  // байқайды. Сондықтан бәрі `topParts` арқылы жүреді.
  if (sidesOverlay) {
    // Бұранда бүйірдің СЫРТЫНАН кіріп, крышка/дноның торціне барады
    for (const face of [sideLeft, sideRight]) {
      for (const edge of [bottom, ...topParts]) confirmatJoint(face, edge, ctx)
    }
  } else {
    // Бұранда крышка/дноның СЫРТЫНАН кіріп, бүйірдің торціне барады
    for (const face of [bottom, ...topParts]) {
      for (const edge of [sideLeft, sideRight]) confirmatJoint(face, edge, ctx)
    }
  }
  // Перегородка екі құрастыруда да крышка мен дноның арасында
  for (const divider of dividers) {
    confirmatJoint(bottom, divider, ctx)
    for (const part of topParts) confirmatJoint(part, divider, ctx)
  }
  // K6: фронтальдық панельдің стойкасы — перегородкамен БІРДЕЙ буын
  if (frontPanelStand) {
    confirmatJoint(bottom, frontPanelStand, ctx)
    for (const part of topParts) confirmatJoint(part, frontPanelStand, ctx)
  }

  /*
   * Цоколь қорабының бұрыштары.
   *
   * Бұранда АЛДЫҢҒЫ (және артқы) тақтайдың бетінен өтіп, бүйірдің торціне
   * барады — бүйір екеуінің арасына кіретіндіктен, басқаша болуы да мүмкін
   * емес. Буын небәрі 95 мм шамасында, сондықтан мұнда `spreadAlongJoint`-тың
   * ҚЫСҚА БУЫН ережесі істейді (тесік жиектен ≥ 24 мм).
   *
   * Қорапты КОРПУСҚА бекіту мұнда ЖОҚ: цех оны әртүрлі істейді (біреуі
   * дноның астынан бұрайды, біреуі бұрышпен). Ойдан тесік жазсақ, дайын
   * детальде артық саңылау қалар еді (§10).
   */
  if (plinthBox !== null) {
    const boxSides = panels.filter((p) => p.id === 'plinth-left' || p.id === 'plinth-right')
    const boxFaces = panels.filter((p) => p.id === 'plinth' || p.id === 'plinth-back')
    for (const face of boxFaces) {
      for (const side of boxSides) {
        // ⚠ 2026-09-20 түзетілді (docs/audit/drilling-2026-09-20.md §R2,
        // drill-a4 тапсырмасы): `confirmatJoint` мен `minifixJoint`
        // аргумент реттерінің РӨЛ МАҒЫНАСЫ КЕРІСІНШЕ.
        //
        // `confirmatJoint(facePanel, edgePanel)`: 1-ші аргумент — бетінен
        // бұранда өтетін панель (face рөлі), 2-ші — торціне пилот кіретін
        // панель (edge рөлі). Жоғарыдағы түсініктемедегідей, бұранда
        // алды/арты тақтасының БЕТІНЕН өтіп, бүйірдің ТОРЦІНЕ барады —
        // сондықтан `confirmatJoint(face, side, ctx)` дәл (face=face
        // рөлінде, side=edge рөлінде, айнымалы атаулар рөлмен сәйкес).
        //
        // `minifixJoint(wall, side)` — керісінше: `wall` параметрі ӘРҚАШАН
        // edge рөлінде (штифт торцке кіреді), `side` параметрі ӘРҚАШАН face
        // рөлінде (штифт бетінен өтеді) — бұл `drilling.ts`-тегі функция
        // қолтаңбасының өз шарты, циклдегі айнымалы атауларға қатысы жоқ.
        // Цоколь қорабында да рөл өзгермейді: алды/арты тақтасы — face,
        // бүйір — edge (бүйір екі тақтайдың АРАСЫНА кіреді, сондықтан оның
        // торці алды/арты тақтасының бетіне тіреледі, §985-995 қара). Демек
        // `wall` аргументіне БҮЙІРДІ (`side` цикл айнымалысы), `side`
        // аргументіне АЛДЫ/АРТЫ тақтасын (`face` цикл айнымалысы) беру
        // керек — яғни рет `confirmatJoint`-ке қарағанда КЕРІ:
        // `minifixJoint(side, face, ctx)`.
        if (plinthBox === 'minifix') minifixJoint(side, face, ctx)
        else confirmatJoint(face, side, ctx)
      }
    }
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

  /*
   * Реттелетін аяқтардың бұрандалары дноның астына. Аяқтардың САНЫ
   * `hardware.ts`-тегі ережемен бір: әр 600 мм-ге бір жұп.
   */
  if (config.base?.kind === 'legs') {
    /*
     * Дно ВКЛАДНОЙ болса, оның нөлі корпустың нөлінен `t` жылжыған — аяқтың
     * орны сол шегерумен беріледі, әйтпесе саңылаулар қисаяды.
     *
     * ⚠ ТАБАНСЫЗ аяққа тесік бұрғыланбайды: бекітілуі тұғырдың түріне қарай
     * әртүрлі, ал ойдан шығарылған тесік дайын детальді бүлдіреді.
     */
    const plate = config.base.legPlate ?? 'round'
    if (plate === 'none') {
      bottom.note = [bottom.note, 'Опора без основания: крепление на усмотрение цеха']
        .filter(Boolean).join('; ')
    } else {
      legScrewHoles(
        bottom,
        legPairsFor(W, config.base.legStep ?? LEG_STEP),
        ctx,
        { x: bottom.position.x, z: bottom.position.z },
        config.base.legHoleSpacing ?? LEG_SCREW_SQUARE,
      )
    }
  }

  /*
   * Ящиктің ҚОРАБЫН жинайтын минификс: алдыңғы және артқы қабырға екі
   * бүйірге де осылай бекітіледі. Бұрын қораптың буындарында присадка
   * МҮЛДЕ жоқ еді.
   */
  for (const wall of panels) {
    if (wall.role !== 'drawerBack') continue
    const prefix = wall.id.slice(0, wall.id.indexOf('-wall-'))
    for (const suffix of ['-side-l', '-side-r']) {
      const side = panels.find((p) => p.id === `${prefix}${suffix}`)
      if (side) minifixJoint(wall, side, ctx)
    }
  }

  /*
   * Ящиктің ТҮБІ (ЛДСП): бүйірлерге минификспен, ал алдыңғы/артқы қабырғаға
   * конфирматпен. Қабырғалар түптің ҮСТІНДЕ тұрғандықтан, бұранда түпті
   * тесіп өтіп, олардың АСТЫҢҒЫ торціне кіреді.
   */
  for (const bottom of panels) {
    if (bottom.role !== 'drawerBottom') continue
    const prefix = bottom.id.slice(0, bottom.id.lastIndexOf('-bottom'))
    const sides = panels.filter((p) => p.id === `${prefix}-side-l` || p.id === `${prefix}-side-r`)
    drawerBottomJoints(bottom, sides, ctx)
    for (const wall of ['-wall-front', '-wall-back']) {
      const panel = panels.find((p) => p.id === `${prefix}${wall}`)
      if (panel) confirmatJoint(bottom, panel, ctx)
    }
  }

  /*
   * Ящиктің фасадын қорапқа бекітетін еврошуруптар. Жұп id-мен табылады:
   * қораптың алдыңғы қабырғасы `…-wall-front`, ал оның фасады `…-front`.
   */
  for (const wall of panels) {
    if (!wall.id.endsWith('-wall-front')) continue
    const facade = panels.find((p) => p.id === `${wall.id.slice(0, -'-wall-front'.length)}-front`)
    if (facade) drawerFacadeScrews(wall, facade, ctx)
  }

  // Направляющая: ящиктің екі жағындағы тік панельге
  for (const run of drawerRuns) {
    const [left, right] = boundsOf(run.sectionIndex)
    // K12: run.boxBottomY — makeDrawers-тен ШИКІ локал y (цокольге
    // көтерілмеген), ал runnerHoles бұл мәнді ӘЛЕМ координатасы деп
    // қабылдайды (бүйір панельдің өз позициясы make() арқылы baseHeight-ке
    // көтерілген). Сондықтан осында да +baseHeight — shelfPinHoles-тегі
    // `t + baseHeight` үлгісімен бірдей (§1339: "shelfPinHoles(left, shelf,
    // t + baseHeight, ctx)").
    // Ящик секцияның ортасында: сол/оң шектің арасы (перегородкада тесік
    // көрші секцияның бетіне емес, осы секцияның бетіне түседі).
    const sectionCentreX = (left.position.x + ctx.thickness(left) + right.position.x) / 2
    runnerHoles(left, run.boxBottomY + baseHeight, run.boxFrontZ, run.boxDepth, sectionCentreX, ctx, drawerSystem)
    runnerHoles(right, run.boxBottomY + baseHeight, run.boxFrontZ, run.boxDepth, sectionCentreX, ctx, drawerSystem)
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

    /*
     * Ілгектің жағы. `auto` — бұрынғы мінез: бірінші фасад солдан, соңғысы
     * оңнан ашылады. Цех оны нақты таңдай алады: бір қатардағы барлық есік
     * бір жаққа ашылатын жиһаз жиі кездеседі (мыс. қабырғаға тірелген шкаф).
     */
    const opening = spec?.opening ?? 'auto'
    /*
     * K6 / audit C4. Осы секцияның сол/оң шетінде фронтальдық панель
     * тұрса, `left`/`right` (`side-left`/`side-right` немесе перегородка)
     * есіктен алшақ — сол шетте нақты корпус панелі жоқ, тек соқыр панель
     * бар. Планка сол жағдайда `frontPanelStand`-қа ілінуі керек.
     */
    const blindLeft = frontPanel?.side === 'left' && group.sectionIndex === 0
    const blindRight = frontPanel?.side === 'right' && group.sectionIndex === layouts.length - 1
    group.fronts.forEach((front, i) => {
      // Шыны фасад — тек КӨРІНІС белгісі: раскрой мен присадка өзгермейді.
      if (spec?.glass) front.glass = true
      if (handle) {
        handleHoles(front, handle.model, handle.spec, ctx)
        const shape = handleShape(handle.model, handle.spec, front.finishedLength, front.finishedWidth)
        if (shape) front.handle = shape
      }
      if (opening === 'up') {
        /*
         * КӨТЕРІЛЕТІН фасад: ілгектің чашкасы бұрғыланбайды.
         *
         * Механизмнің түрі моделіне қарай мүлде әртүрлі (Aventos HK бір
         * чашкамен, HF екеуімен, арқандысы басқаша), ал цех оларды бәрібір
         * өндірушінің қағаз шаблонымен бұрғылайды. Ойдан шығарылған тесік
         * дайын фасадты бүлдіреді, сондықтан мұнда ЕСКЕРТПЕ ғана.
         */
        front.opening = { kind: 'flap' }
        front.note = [front.note, 'Подъёмный: присадка по шаблону механизма']
          .filter(Boolean).join('; ')
        if (milling) {
          validateMilling(milling, ctx.thickness(front))
          applyMilling(front, millingPaths(milling, front.finishedWidth, front.finishedLength), ctx)
        }
        return
      }
      const side: 'left' | 'right' = opening === 'auto'
        ? (i === last && last > 0 ? 'right' : i % 2 === 0 ? 'left' : 'right')
        : opening
      // Планка ілгек ілінетін тік панельге бұрғыланады, сондықтан ол
      // ілгектің ЖАҒЫМЕН таңдалады — әйтпесе сол жақтан ашылатын фасадтың
      // планкасы оң жақтағы панельге түсіп кетер еді.
      const carcassPanel = side === 'left'
        ? (i === 0 ? (blindLeft ? frontPanelStand ?? undefined : left) : undefined)
        : (i === last ? (blindRight ? frontPanelStand ?? undefined : right) : undefined)
      // 3D-дегі анимация ІЛГЕКТІҢ жағын осы жерден алады: екеуі бір шешімнен
      // шықса, есік ешқашан «басқа жаққа» ашылмайды.
      front.opening = { kind: 'door', side }
      hingeHoles(front, carcassPanel, side, ctx, hingeSystem)
      if (milling) {
        validateMilling(milling, ctx.thickness(front))
        applyMilling(front, millingPaths(milling, front.finishedWidth, front.finishedLength), ctx)
      }
    })
  }

  /*
   * Ящик фасадының тұтқасы — ілмелі фасадтағы ДӘЛ СОЛ ереже: тесік те, 3D
   * пішіні де `handleBorePoints`-тен. Смета тұтқаны тесіктен санайды,
   * сондықтан ящиктің тұтқасы енді ақшаға да кіреді.
   */
  for (const group of drawerHandles) {
    const handle = resolveHandle(catalog, group.spec, group.field)
    if (!handle) continue
    for (const front of group.fronts) {
      handleHoles(front, handle.model, handle.spec, ctx)
      const shape = handleShape(handle.model, handle.spec, front.finishedLength, front.finishedWidth)
      if (shape) front.handle = shape
    }
  }

  // ── Ерікті детальдар («Деталь») ────────────────────────────────────────────
  // Параметрлі модель жетпей қалғанда цех детальді ӨЗІ қояды. Ол мұнда,
  // корпустың панельдері дайын болғаннан кейін қосылады — сондықтан
  // деталировка да, раскрой да, смета да оны қалғанымен БІРДЕЙ көреді.
  const usedIds = new Set(panels.map((p) => p.id))
  ;(config.customParts ?? []).forEach((part, i) => {
    const field = `customParts[${i}]`
    if (usedIds.has(part.id)) {
      throw new ConfigValidationError(`${field}.id`, `id қайталанды: "${part.id}"`, 'бірегей id')
    }
    usedIds.add(part.id)

    validateCustomDimension(part.length, `${field}.length`)
    validateCustomDimension(part.width, `${field}.width`)

    const material = part.materialId
      ? requireMaterial(materials, part.materialId, `${field}.materialId`)
      : carcass

    const orientation = part.plane === 'horizontal'
      ? ORIENT_HORIZONTAL
      : part.plane === 'vertical' ? ORIENT_SIDE : ORIENT_FACING

    panels.push(make(
      part.id, 'custom', part.label, material,
      part.length, part.width, part.position, orientation, part.note ?? '',
      customPartEdges(part.edging, config.edging),
    ))
  })

  // Оймалар: панельдің ішінен алынатын тесіктер (раковина, розетка, құбыр).
  applyCutouts(panels, config.panelCutouts)
  // Жеке детальдің текстурасы мен бұрыштарының радиусы.
  applyPanelOverrides(panels, config.panelGrain, config.panelCorners)

  // Қолмен түзетілген присадка — ЕҢ СОҢЫНДА. Осылай 3D те, DXF те, смета да
  // бірдей тесіктерді көреді: панель — жалғыз ақиқат көзі (§3).
  applyDrillEdits(panels, config.drillEdits)

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
  field = 'fronts.handle.handleId',
): { model: HandleModel; spec: HandleSpec } | undefined {
  const list = catalog.handles
  if (!list || list.length === 0) return undefined
  if (spec === null) return undefined
  const wanted = spec ?? defaultHandleSpec()
  const model = list.find((h) => h.id === wanted.handleId)
    ?? (spec ? undefined : list.find((h) => h.id === DEFAULT_HANDLE_ID) ?? list[0])
  if (!model) {
    throw new ConfigValidationError(field, `тұтқа табылмады: "${wanted.handleId}"`)
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
  fronts: { count: number; mount: 'overlay' | 'inset'; gaps?: FrontGaps | undefined },
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

  /*
   * Зазорлар. Берілмеген жағы цехтың бір санынан алынады, сондықтан ескі
   * жоба дәл бұрынғыдай есептеледі. Тек СЫРТҚЫ зазорлар (сол, оң, үст, аст)
   * пен ІШКІ зазор (фасадтар арасы) бөлек: ас үй қатарында олар шынымен
   * әртүрлі болады.
   */
  const g = fronts.gaps ?? {}
  const gapDefault = settings.frontGap
  const between = g.between ?? gapDefault
  const gapLeft = g.left ?? gapDefault
  const gapRight = g.right ?? gapDefault
  const gapTop = g.top ?? gapDefault
  const gapBottom = g.bottom ?? gapDefault
  for (const [name, value] of Object.entries({ between, left: gapLeft, right: gapRight, top: gapTop, bottom: gapBottom })) {
    if (!Number.isInteger(value) || value < 0 || value > 50) {
      throw new ConfigValidationError(
        `sections[${sectionIndex}].fronts.gaps.${name}`, `${value}`, '0..50 мм, бүтін сан',
      )
    }
  }

  const usableWidth = slot.width - gapLeft - gapRight - (n - 1) * between
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
  /*
   * Қалған миллиметрлер СЫРТҚЫ саңылаулардан бастап бір-бірлеп таратылады
   * (§4.7). Зазорлар әртүрлі болғанда да ереже сол: фасадтар БІРДЕЙ қалады,
   * ал айырма саңылауға сіңеді. Таратылатыны — берілген зазорлардан АРТЫҚ
   * қалған бөлігі ғана.
   */
  const base = [gapLeft, ...Array.from({ length: n - 1 }, () => between), gapRight]
  const leftover = slot.width - n * frontWidth - base.reduce((sum, v) => sum + v, 0)
  const extra = distributeMillimetres(leftover, n + 1, gapFillOrder(n + 1))
  const gaps = base.map((v, i) => v + (extra[i] ?? 0))
  const frontHeight = spanY - gapTop - gapBottom
  const note = fronts.mount === 'inset' ? 'Фасад вкладной' : 'Фасад накладной'

  const out: Panel[] = []
  let x = slot.x
  for (let i = 0; i < n; i += 1) {
    x += gaps[i] ?? 0
    out.push(
      make(
        `${section.id}-front-${i + 1}`, 'front', 'Фасад', material,
        frontHeight, frontWidth, { x, y: originY + gapBottom, z }, ORIENT_FACING, note,
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

/**
 * Ерікті детальдің өлшемі. Шегі корпустікінен КЕҢ: царга 80 мм, қатырғыш
 * одан да тар болуы мүмкін, ал ондай деталь нақты жиһазда бар. Төменгі шек —
 * планканікімен бір (`MIN_RAIL_WIDTH`): одан тар жолақты кесу де, кромкалау
 * да мағынасыз.
 */
function validateCustomDimension(value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw new ConfigValidationError(field, `${value} — бүтін сан емес`, 'мм, бүтін сан')
  }
  if (value < MIN_RAIL_WIDTH || value > MAX_DIMENSION) {
    throw new ConfigValidationError(field, `${value} мм`, `${MIN_RAIL_WIDTH}..${MAX_DIMENSION} мм`)
  }
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
    panels.map((panel) => ({ ...panel, id: projectPanelId(cabinetId, panel.id, items.length) })),
  )
}

/**
 * Детальдің ЖОБА ІШІНДЕГІ кілті. Ережесі `mergeProjectPanels`-пен БІР болуы
 * керек: сахна мен тізім бір детальді бір атпен білгенде ғана 3D-дегі
 * бөлектеу мен қағаздағы жол қатар жүреді.
 */
export function projectPanelId(cabinetId: string, panelId: string, cabinetCount: number): string {
  return cabinetCount === 1 ? panelId : `${cabinetId}--${panelId}`
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
  /** Таңдалған направляющая; берілмесе — ескі мінез (settings-тен). */
  system: DrawerSystem | null
  /** Металл жәшік таңдалса — оның кестесі. Ағаш қорап жасалмайды. */
  metalBox: MetalBoxSystem | null
  metalBoxBackHeight?: number | undefined
  /** Фронтальдық панель ұяны осынша тарылтады (деталь ЖАСАЛМАЙДЫ — ол бар). */
  openingInset: { side: 'left' | 'right'; width: number } | null
}): { panels: Panel[]; runs: { boxBottomY: number; boxFrontZ: number; boxDepth: number }[] } {
  const { section, sectionIndex, bandIndex, band, layout, slot, settings, carcass, frontMat, backMat, shelfDepth, make, system, metalBox, metalBoxBackHeight, openingInset } = input
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
  /*
   * Саңылаулар. Берілмегені цехтың `frontGap`-ынан алынады — сондықтан
   * ештеңе берілмесе, есеп ЕСКІ жолмен, миллиметрі-миллиметрімен бірдей
   * жүреді (§8.7 эталоны соны күзетеді).
   */
  const g = content.gaps ?? {}
  const gapTop = g.top ?? gap
  const gapBottom = g.bottom ?? gap
  const gapBetween = g.between ?? gap
  const gapLeft = g.left ?? gap
  const gapRight = g.right ?? gap
  for (const [name, value] of Object.entries({
    top: gapTop, bottom: gapBottom, between: gapBetween, left: gapLeft, right: gapRight,
  })) {
    if (!Number.isInteger(value) || value < 0 || value > 50) {
      throw new ConfigValidationError(
        `sections[${sectionIndex}].contents[${bandIndex}].gaps.${name}`,
        `${value} мм`, '0..50 мм, бүтін сан',
      )
    }
  }

  // Фасадтар жолақты тең бөледі. Биіктік бүтінге ТӨМЕН дөңгеленеді — бір
  // жолақтағы фасадтар әрқашан бірдей болуы керек.
  const frontHeight = Math.floor(
    (band.height - gapTop - gapBottom - (n - 1) * gapBetween) / n,
  )
  if (frontHeight < MIN_DIMENSION) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents[${bandIndex}].count`,
      `${n} ящика дают фасад высотой ${frontHeight} мм`,
      `высота фасада ≥ ${MIN_DIMENSION} мм`,
    )
  }
  const leftover = band.height - n * frontHeight
  const customVertical = g.top !== undefined || g.bottom !== undefined || g.between !== undefined
  const gaps = customVertical
    // Артық миллиметрлер саңылауларға ҮСТЕМЕ болып таралады: жолақ әрқашан
    // толық жабылуы керек, әйтпесе астында түсініксіз саңылау қалады.
    ? distributeMillimetres(leftover - gapTop - gapBottom - (n - 1) * gapBetween, n + 1)
      // ⚠ Реті ТӨМЕННЕН жоғары: `y` жолақтың астынан өседі, сондықтан бірінші
      // саңылау — АСТЫҢҒЫСЫ.
      .map((extra, i) => extra + (i === 0 ? gapBottom : i === n ? gapTop : gapBetween))
    : distributeMillimetres(leftover, n + 1)

  /*
   * Қораптың ені мен тереңдігі — направляющаның ӨЛШЕМІ.
   *
   * Жүйе таңдалса, саңылау да, тереңдік те содан алынады, әрі тереңдігі
   * НОМИНАЛДЫ ұзындыққа дөңгеленеді: направляющая 50 мм қадаммен ғана
   * сатылады, ал қорап оған дәл тең болуы керек. Жүйе таңдалмаса — бәрі
   * бұрынғыдай, цехтың профилінен.
   */
  /*
   * ЖАНАМА ПЛАНКАЛАР ұяны тарылтады: направляющая соларға бекітіледі.
   * Фасад тарылмайды — планка фасадтың артында қалады.
   */
  const fillerLeft = content.fillers?.left ?? 0
  const fillerRight = content.fillers?.right ?? 0
  /*
   * ⚠ Планка КОРПУС материалынан кесіледі, сондықтан оның қалыңдығы — сол
   * материалдың қалыңдығы. Одан қалыңы қажет болса, цех оны қабаттап
   * желімдейді, сондықтан рұқсат етілгені — қалыңдықтың ЕСЕЛІГІ. Кез келген
   * санды қабылдап, содан соң 16 мм деталь беру — ұяны дұрыс тарылтпайтын,
   * бірақ тек цехта байқалатын қате болар еді.
   */
  for (const [name, value] of Object.entries({ left: fillerLeft, right: fillerRight })) {
    if (!Number.isInteger(value) || value < 0 || value > 200 || value % t !== 0) {
      throw new ConfigValidationError(
        `sections[${sectionIndex}].contents[${bandIndex}].fillers.${name}`,
        `${value} мм`,
        `0..200 мм, ${t} мм-ге еселік (планка корпус материалынан кесіледі)`,
      )
    }
  }
  const insetLeft = fillerLeft + (openingInset?.side === 'left' ? openingInset.width : 0)
  const insetRight = fillerRight + (openingInset?.side === 'right' ? openingInset.width : 0)
  const openingX = layout.x + insetLeft
  const openingWidth = layout.width - insetLeft - insetRight

  // Вкладной фасад секцияның ТАЗА ұясында отырады, накладной — кеңірек ұяда
  // (ілмелі фасадтағы ережемен бірдей).
  const insetFront = content.frontMount === 'inset'
  const frontSlot = insetFront ? { x: layout.x, width: layout.width } : slot

  const clearance = system ? system.sideClearance : settings.drawerRunnerGap
  const boxWidth = Math.floor(openingWidth - 2 * clearance)
  const available = shelfDepth - settings.drawerBackGap
  const lengths = system ?? metalBox
  const nominal = lengths ? nominalRunnerLength(lengths, available) : available
  if (nominal === null) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents[${bandIndex}]`,
      `под ящик остаётся ${available} мм`,
      `${lengths!.name}: самая короткая направляющая ${Math.min(...lengths!.nominalLengths)} мм`,
    )
  }
  // Тандем қораптың АСТЫНДА жатады, сондықтан қорап направляющадан сәл қысқа.
  const boxDepth = system ? nominal - system.boxDepthSub : nominal
  const boxHeight = frontHeight - settings.drawerBoxDrop
  /*
   * ── МЕТАЛЛ ЖӘШІК ──────────────────────────────────────────────────────────
   *
   * Қорап сатып алынады: бүйірі де, арты да, направляющасы да сол жиынтықта.
   * Парақтан тек ТҮБІ мен АРТ ҚАБЫРҒАСЫ кесіледі, ал олардың өлшемі
   * өндірушінің кестесінен шығады (`drawerSystems.ts`, өлшенген сандар).
   *
   * Сондықтан мұнда ағаш қораптың бірде-бір бөлшегі жасалмайды: бүйірі де,
   * алдыңғы қабырғасы да, минификсі де. Оларды «бәрібір керек шығар» деп
   * қосу цехқа артық деталь беріп, металл қораппен қатар кесілер еді.
   */
  const metalParts = metalBox
    ? metalBoxParts(metalBox, openingWidth, nominal, metalBoxBackHeight)
    : null
  if (metalParts && (metalParts.bottom.width < MIN_DIMENSION || metalParts.bottom.depth < MIN_DIMENSION)) {
    throw new ConfigValidationError(
      `sections[${sectionIndex}].contents[${bandIndex}]`,
      `дно ящика получается ${metalParts.bottom.width}×${metalParts.bottom.depth} мм`,
      `${metalBox!.name}: каждая сторона ≥ ${MIN_DIMENSION} мм`,
    )
  }

  // Қораптың БИІКТІГІНЕ бөлек еден: 60–80 мм ұсақ заттарға арналған ящик —
  // қалыпты нәрсе, ал ені мен тереңдігі 100 мм-ден кем болса, ол ящик емес.
  if (!metalParts
    && (boxWidth < MIN_DIMENSION || boxDepth < MIN_DIMENSION || boxHeight < MIN_DRAWER_BOX_HEIGHT)) {
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

  /*
   * Планканың өзі — ДЕТАЛЬ: ол парақтан кесіледі әрі сметаға түседі.
   * Жолақтың толық биіктігінде тұрады да, тереңдігі қораппен бірдей:
   * направляющая соның бойымен бекітіледі.
   */
  for (const [side, width, x0] of [
    ['левая', fillerLeft, layout.x],
    ['правая', fillerRight, layout.x + layout.width - fillerRight],
  ] as const) {
    const layers = width / t
    for (let layer = 0; layer < layers; layer += 1) {
      const suffix = side === 'левая' ? 'l' : 'r'
      panels.push(make(
        `${section.id}-b${bandIndex + 1}-filler-${suffix}${layers > 1 ? `-${layer + 1}` : ''}`,
        'rail', 'Планка ящика', carcass,
        band.height, boxDepth,
        { x: x0 + layer * t, y: band.y, z: settings.shelfSetback }, ORIENT_SIDE,
        layers > 1
          ? `Планка под направляющую, ${side}, слой ${layer + 1} из ${layers}`
          : `Планка под направляющую, ${side}`,
      ))
    }
  }

  let y = band.y

  for (let i = 0; i < n; i += 1) {
    y += gaps[i] ?? 0
    const id = `${section.id}-b${bandIndex + 1}-drawer-${i + 1}`

    /*
     * Фасад: накладной корпустың АЛДЫНДА тұрады да, бүйірлерді жабады;
     * вкладной ұяның ІШІНДЕ отырады да, алдыңғы жиекпен беттеседі.
     */
    const front = make(
      `${id}-front`, 'front', 'Фасад ящика', frontMat,
      frontHeight, frontSlot.width - gapLeft - gapRight,
      { x: frontSlot.x + gapLeft, y, z: insetFront ? 0 : -frontMat.thickness },
      ORIENT_FACING,
      insetFront ? 'Фасад ящика, вкладной' : 'Фасад ящика, накладной',
    )
    panels.push(front)

    const boxX = Math.round(openingX + clearance)
    const boxY = y + settings.drawerBoxDrop / 2

    if (metalParts) {
      // Металл жәшік: парақтан ТЕК осы екеуі кесіледі.
      panels.push(make(
        `${id}-bottom`, 'drawerBottom', 'Дно ящика', carcass,
        // ORIENT_HORIZONTAL: ұзындығы X (ен), ені Z (тереңдік).
        metalParts.bottom.width, metalParts.bottom.depth,
        {
          x: Math.round(openingX + (openingWidth - metalParts.bottom.width) / 2),
          y: boxY,
          z: settings.shelfSetback,
        },
        ORIENT_HORIZONTAL,
        `Дно ящика, ${metalBox!.name}`,
      ))
      panels.push(make(
        `${id}-wall-back`, 'drawerBack', 'Задняя стенка ящика', carcass,
        // ORIENT_FACING: ұзындығы Y (биіктік), ені X.
        metalParts.back.height, metalParts.back.width,
        {
          x: Math.round(openingX + (openingWidth - metalParts.back.width) / 2),
          y: boxY,
          z: settings.shelfSetback + metalParts.bottom.depth - t,
        },
        ORIENT_FACING,
        `Задняя стенка ящика, ${metalBox!.name}`,
      ))

      const opening: PanelOpening = {
        kind: 'drawer',
        travel: Math.round(metalParts.bottom.depth * 0.8),
      }
      for (const panel of panels) {
        if (panel.id.startsWith(id)) panel.opening = opening
      }
      // Металл қорапта бүйір жоқ, сондықтан направляющаға присадка да жоқ:
      // ол корпусқа өз шаблонымен бекітіледі.
      y += frontHeight
      continue
    }

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

    /*
     * Алдыңғы және артқы қабырға ТҮБІНІҢ ҮСТІНДЕ тұрады (түбі 16 мм ЛДСП,
     * төменде қара). Сондықтан олардың биіктігі бір қалыңдыққа қысқарады да,
     * бастауы сол қалыңдыққа көтеріледі — әйтпесе қабырға түбімен қабаттасып,
     * қорап сұралғаннан биік болып шығар еді.
     */
    for (const [wall, z] of [['front', settings.shelfSetback], ['back', settings.shelfSetback + boxDepth - t]] as const) {
      panels.push(
        make(
          // `-wall-` міндетті: фасадтың id-і `${id}-front`, ал ол екеуі бір
          // болса, DXF архивінде файл бірін-бірі басып кетеді.
          `${id}-wall-${wall}`, 'drawerBack',
          wall === 'front' ? 'Передняя стенка ящика' : 'Задняя стенка ящика', carcass,
          // ORIENT_FACING: ұзындық Y (биіктік), ені X.
          boxHeight - t, wallLength,
          { x: boxX + t, y: boxY + t, z }, ORIENT_FACING, 'Короб ящика',
        ),
      )
    }

    /*
     * Түбі — КОРПУС материалы (ЛДСП), бүйірлердің АРАСЫНДА жатады.
     *
     * Бұрын 3 мм ХДФ қораптың астынан қағылатын. Онда түп буынға қатыспайтын
     * да, қорап тек төрт қабырғамен ұсталатын. Енді түп те жүктеме көтереді:
     * бүйірлерге минификспен, алды-артына конфирматпен бекітіледі
     * (`drilling.ts` қара) — бұл qdesign-нің де схемасы.
     */
    panels.push(
      make(
        `${id}-bottom`, 'drawerBottom', 'Дно ящика', carcass,
        // ORIENT_HORIZONTAL: ұзындық X (ен), ені Z (тереңдік).
        wallLength, boxDepth,
        { x: boxX + t, y: boxY, z: settings.shelfSetback }, ORIENT_HORIZONTAL,
        'Дно ящика, ЛДСП',
      ),
    )

    /*
     * Ящиктің БАРЛЫҚ детальі бірге жылжиды: фасады да, қорабы да. Шығу
     * жолы — қораптың тереңдігінің 80%-ы: толық шығару направляющаға
     * байланысты, ал ішіндегі затты көрсетуге осы да жетеді.
     */
    const opening: PanelOpening = { kind: 'drawer', travel: Math.round(boxDepth * 0.8) }
    for (const panel of panels) {
      if (panel.id.startsWith(id)) panel.opening = opening
    }

    runs.push({ boxBottomY: boxY, boxFrontZ: settings.shelfSetback, boxDepth })
    y += frontHeight
  }

  return { panels, runs }
}
