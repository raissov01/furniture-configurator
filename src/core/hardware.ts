/**
 * Панель ЕМЕС фурнитура: штанга, купе рельсі, цоколь аяғы.
 *
 * Бұлар парақтан кесілмейді — сатып алынады. Сондықтан олар `Panel[]`-ге
 * кірмейді (әйтпесе деталировкаға да, раскройға да түсіп кетер еді), бірақ
 * 3D-де көріну керек әрі сметаға түсуі керек.
 *
 * Орналасу ЯДРОНЫҢ өзінде есептеледі: секция мен жолақ картасы `generateCabinet`
 * қолданатын дәл сол `layoutSections` / `layoutBands` арқылы алынады, сондықтан
 * штанганың орны шкафтың ішкі құрылымымен ешқашан алшақтамайды.
 */

import { LEG_PLATE_ROUND_DIAMETER, LEG_PLATE_SQUARE_SIDE, LEG_STEP, mergeSettings } from './constants'
import { HOOD_CLEARANCE, findAppliance, findFilling, findFixture } from './filling'
import type { ApplianceKind, FixtureVisual } from './filling'
import { ConfigValidationError } from './errors'
import { carcassDepthAt, layoutBands } from './generateCabinet'
import { findMetalBoxSystem, isMetalBoxSystem } from './drawerSystems'
import { legCentres, legPairsFor } from './drilling'
import { layoutSections } from './sections'
import type { CabinetConfig, CabinetFixture, Catalog, LegPlate, LegType, SettingsOverride, Vec3 } from './types'

export type HardwareKindPlaced =
  | 'rod' | 'rodBracket' | 'slidingTrack' | 'slidingDoorKit' | 'leg'
  /** Механизм: брючница, пантограф, … — цех сатып алады, сметаға түседі. */
  | 'filling'
  /** Техниканың ұясы — 3D-де көрінеді, бірақ сметаға ТҮСПЕЙДІ. */
  | 'appliance'

export type HardwarePlacement = {
  kind: HardwareKindPlaced
  /** Сметадағы позицияның id-і (`ShopProfile.hardware`) */
  hardwareId: string
  label: string
  qty: number
  /** Ұзындығы бар нәрселерге (штанга) — мм, әйтпесе 0 */
  length: number
  /** 3D үшін: цилиндрдің ортасы */
  position: Vec3
  /** Штанганың бағыты: әрқашан X (секцияның ені бойымен) */
  axis: 'x'
  /** Қорап пішінді нәрсеге (техника, механизм) — габариті, мм. */
  size?: Vec3 | undefined
  /** 3D реңкі; болмаса қалыпты фурнитура түсі. */
  color?: string | undefined
  /** Техниканың ТҮРІ — 3D пішінді содан алады (тоңазытқыш, мойка, …). */
  appliance?: ApplianceKind | FixtureVisual | undefined
  /** Аяққа — оның түрі: 3D пішінді содан алады. */
  legType?: LegType | undefined
  /** Аяққа — табанының пішіні. */
  legPlate?: LegPlate | undefined
  /** Табанның өлшемі, мм (дөңгелекке — диаметрі, шаршыға — қабырғасы). 0 — жоқ. */
  plateSize?: number | undefined
  /**
   * Сметаға түсе ме. Техника — КЛИЕНТТІКІ, сондықтан `false`: ойдан жазылған
   * баға клиентке кеткен КП-ға түсер еді.
   */
  priced: boolean
}

/**
 * Штанганың жолақтың ҮСТІНЕН қанша төмен тұратыны, мм.
 *
 * ⚠ Бұл цехтың таңдауы: ілгіштің биіктігіне байланысты. Әдепкі 60 мм —
 * жалпы қабылданған шама, бірақ профильде түзетілуі керек.
 */
const ROD_DROP_FROM_TOP = 60

/** Штанганың диаметрі, мм — тек 3D үшін. */
export const ROD_DIAMETER = 25

/**
 * Аяқтың түрлері: артикулы, атауы, диаметрі.
 *
 * Диаметр тек 3D үшін емес — цоколь клипсасы аяқтың диаметріне қарай
 * таңдалады, сондықтан ол мұнда БІР жерде тұр.
 */
export const LEG_SPECS: Record<LegType, {
  hardwareId: string
  label: string
  diameter: number
}> = {
  // ⚠ Артикулы ЕСКІ күйінде: бұрыннан сақталған жобаның сметасы өзгермеуі керек.
  cylinder: { hardwareId: 'leg-100', label: 'Ножка регулируемая', diameter: 50 },
  cone: { hardwareId: 'leg-cone', label: 'Ножка коническая', diameter: 60 },
  square: { hardwareId: 'leg-square', label: 'Ножка квадратная', diameter: 50 },
  vector: { hardwareId: 'leg-vector', label: 'Ножка «вектор» (наклонная)', diameter: 45 },
  // Тұғырсыз: тек табаны бұралады, оның үстіне цоколь тіреледі.
  none: { hardwareId: 'leg-hidden', label: 'Опора скрытая (без стойки)', diameter: 40 },
}

/** Табанның өлшемі, мм. `none` — табан жоқ, бұранда да жоқ. */
export const LEG_PLATE_SIZE: Record<LegPlate, number> = {
  round: LEG_PLATE_ROUND_DIAMETER,
  square: LEG_PLATE_SQUARE_SIDE,
  none: 0,
}

export function generateHardware(
  config: CabinetConfig,
  catalog: Catalog,
  projectSettings?: SettingsOverride,
): HardwarePlacement[] {
  const settings = mergeSettings(projectSettings, config.settings)
  const carcass = catalog.materials.find((m) => m.id === config.carcassMaterialId)
  if (!carcass) {
    throw new ConfigValidationError(
      'carcassMaterialId', `материал табылмады: "${config.carcassMaterialId}"`,
    )
  }

  const t = carcass.thickness
  const innerWidth = config.width - 2 * t
  const innerHeight = config.height - 2 * t
  const isGroove = config.back.mode === 'groove'
  const backAllowance = isGroove ? settings.grooveInset : settings.backThickness
  const shelfDepth = config.depth - backAllowance - settings.shelfSetback

  const { layouts } = layoutSections(config.sections, innerWidth, t, t)
  const out: HardwarePlacement[] = []

  // Корпус тіректің үстінде тұр — фурнитураның биіктігі де көтеріледі.
  const baseHeight = config.base ? config.base.height : 0

  if (config.base?.kind === 'legs') {
    const legType: LegType = config.base.legType ?? 'cylinder'
    const spec = LEG_SPECS[legType]
    /*
     * ⚠ Аяқтың орны ПРИСАДКАМЕН бір көзден алынады (`legCentres`). Бұрын
     * мұнда бір ғана «шоғырланған» позиция тұратын: 3D-де аяқ мүлде
     * көрінбейтін де, оның бұрандамен бір жерде екенін ешкім тексере
     * алмайтын. Енді әр аяқ бөлек тұр — 3D де, жинау нұсқауы да соны оқиды.
     */
    // ⚠ Тереңдік — КОРПУСТЫҚІ (`carcassDepthAt`), габарит емес: накладной
    // арт қабырға дноның артында тұрады, ал аяқ дноға бұралады.
    const legDepth = carcassDepthAt(config, settings)
    const plate: LegPlate = config.base.legPlate ?? 'round'
    const step = config.base.legStep ?? LEG_STEP
    for (const centre of legCentres(config.width, legDepth, legPairsFor(config.width, step))) {
      out.push({
        kind: 'leg',
        priced: true,
        hardwareId: spec.hardwareId,
        label: spec.label,
        qty: 1,
        length: 0,
        position: { x: centre.x, y: baseHeight / 2, z: centre.z },
        axis: 'x',
        size: { x: spec.diameter, y: baseHeight, z: spec.diameter },
        legType,
        legPlate: plate,
        // Табан дноға тіреледі, сондықтан оның қалыңдығы тұғырға қосылмайды —
        // 3D-де ол жұқа диск/пластина болып қана көрінеді.
        plateSize: LEG_PLATE_SIZE[plate],
      })
    }
  }

  /*
   * МЕТАЛЛ ЖӘШІК — сатып алынатын ЖИЫНТЫҚ (бүйірлері + направляющасы).
   *
   * Ағаш қораптың направляющасы присадканың тесігінен саналады, ал металл
   * жәшікте тесік ЖОҚ: ол корпусқа өз шаблонымен бекітіледі. Сондықтан ол
   * осында, конфигурациядан саналады — әйтпесе сметада мүлде көрінбей
   * қалар еді.
   */
  if (config.drawerSystem && isMetalBoxSystem(config.drawerSystem)) {
    const box = findMetalBoxSystem(config.drawerSystem)
    const count = config.sections.reduce(
      (sum, section) => sum + section.contents.reduce(
        (n, content) => n + (content.kind === 'drawers' ? content.count : 0), 0,
      ), 0,
    )
    if (count > 0) {
      out.push({
        kind: 'filling',
        priced: true,
        hardwareId: box.hardwareId,
        label: `${box.name} (комплект)`,
        qty: count,
        length: 0,
        position: { x: config.width / 2, y: baseHeight, z: config.depth / 2 },
        axis: 'x',
      })
    }
  }

  // Купе: екі рельс (жоғарғы, төменгі) + әр есікке профиль мен ролик жиынтығы.
  if (config.sliding) {
    out.push({
      kind: 'slidingTrack',
      priced: true,
      hardwareId: 'sliding-track',
      label: 'Рельс для дверей-купе (верх + низ)',
      qty: 2,
      length: config.width * 2,
      position: { x: config.width / 2, y: config.height + baseHeight, z: 0 },
      axis: 'x',
    })
    out.push({
      kind: 'slidingDoorKit',
      priced: true,
      hardwareId: 'sliding-kit',
      label: 'Комплект профиля и роликов на дверь',
      qty: config.sliding.count,
      length: 0,
      position: { x: config.width / 2, y: config.height / 2 + baseHeight, z: 0 },
      axis: 'x',
    })
  }

  layouts.forEach((layout, sectionIndex) => {
    const bands = layoutBands(layout.section.contents, innerHeight, t, sectionIndex)
    bands.forEach((band, bandIndex) => {
      // Механизм: жолақтың ортасында тұрады, панель шығармайды.
      if (band.content.kind === 'filling') {
        const model = findFilling(band.content.filling)
        if (layout.width < model.minWidth) {
          throw new ConfigValidationError(
            `sections[${sectionIndex}].contents[${bandIndex}].filling`,
            `${model.name}: секция ${layout.width} мм`,
            `≥ ${model.minWidth} мм`,
          )
        }
        out.push({
          kind: 'filling',
          hardwareId: model.hardwareId,
          label: model.name,
          qty: 1,
          // Механизм ДАНАМЕН сатылады, метрмен емес: ені `size`-та тұр.
          length: 0,
          position: {
            x: layout.x + layout.width / 2,
            y: band.y + band.height / 2 + baseHeight,
            z: settings.shelfSetback + shelfDepth / 2,
          },
          axis: 'x',
          size: { x: layout.width, y: band.height, z: shelfDepth },
          priced: true,
        })
        return
      }

      // Техниканың ұясы: 3D-де қорап болып көрінеді, сметаға түспейді.
      if (band.content.kind === 'appliance') {
        const model = findAppliance(band.content.appliance)
        if (layout.width < model.minWidth) {
          throw new ConfigValidationError(
            `sections[${sectionIndex}].contents[${bandIndex}].appliance`,
            `${model.name}: ниша ${layout.width} мм`,
            `≥ ${model.minWidth} мм`,
          )
        }
        out.push({
          kind: 'appliance',
          hardwareId: `appliance-${model.id}`,
          label: model.name,
          qty: 1,
          length: 0,
          position: {
            x: layout.x + layout.width / 2,
            y: band.y + band.height / 2 + baseHeight,
            z: settings.shelfSetback + shelfDepth / 2,
          },
          axis: 'x',
          size: { x: layout.width, y: band.height, z: shelfDepth },
          color: model.color,
          appliance: model.id,
          priced: false,
        })
        return
      }

      if (band.content.kind !== 'rod') return

      const y = band.y + band.height - ROD_DROP_FROM_TOP + baseHeight
      const z = settings.shelfSetback + shelfDepth / 2

      out.push({
        kind: 'rod',
        priced: true,
        hardwareId: 'rod-25',
        label: 'Штанга Ø25',
        qty: 1,
        length: layout.width,
        position: { x: layout.x + layout.width / 2, y, z },
        axis: 'x',
      })
      out.push({
        kind: 'rodBracket',
        priced: true,
        hardwareId: 'rod-bracket',
        label: 'Держатель штанги',
        // Екі ұшында бір-бірден.
        qty: 2,
        length: 0,
        position: { x: layout.x + layout.width / 2, y, z },
        axis: 'x',
      })
      void bandIndex
    })
  })

  /*
   * СТОЛЕШНИЦАДАҒЫ ТЕХНИКА мен СОРҒЫШ (`config.fixtures`).
   *
   * Орны корпустың өзінен: мойка мен панель столешницаның ҮСТІНДЕ, оның
   * тереңдігінің ортасында; сорғыш панельден нұсқаулықтағы қашықтықта,
   * қабырғаға тіреліп. Столешница болмаса — корпустың үстінде.
   */
  const fixtures = config.fixtures ?? []
  if (fixtures.length > 0) {
    const worktopMat = config.worktop?.materialId
      ? catalog.materials.find((m) => m.id === config.worktop!.materialId)
      : carcass
    const surface = config.height + baseHeight + (config.worktop ? (worktopMat?.thickness ?? t) : 0)
    const overhang = config.worktop?.overhangFront ?? 0
    const hob = fixtures.find((f): f is Extract<CabinetFixture, { kind: 'hob' }> => f.kind === 'hob')
    /*
     * Техника корпустың АШЫҚ бөлігінің ортасында. Бұрыштық тумбада (фронт.
     * панельмен, qdesign «Мойка угловая») бір жағы соқыр: мойка бүкіл 1450 мм
     * енінің ортасына емес, есік жақтағы бөліктің ортасына тұрады — әйтпесе
     * соқыр бұрышқа, көрші қатардың тумбасының артына кетер еді.
     */
    const blind = config.frontPanel?.width ?? 0
    const openWidth = config.width - blind
    const openCenter = config.frontPanel?.side === 'left' ? blind + openWidth / 2 : openWidth / 2

    fixtures.forEach((fixture, i) => {
      const id: FixtureVisual = fixture.kind === 'hob'
        ? (fixture.fuel === 'gas' ? 'hobGas' : 'hobElectric')
        : fixture.kind
      const model = findFixture(id)
      if (openWidth < model.minWidth) {
        throw new ConfigValidationError(
          `fixtures[${i}]`, `${model.name}: модуль ${openWidth} мм`, `≥ ${model.minWidth} мм`,
        )
      }
      // Модульге сыйғызамыз: екі жағынан кемінде 20 мм қалады.
      const width = Math.min(model.width, openWidth - 40)
      const common = {
        kind: 'appliance' as const,
        appliance: id,
        hardwareId: `appliance-${id}`,
        label: model.name,
        qty: 1,
        length: 0,
        axis: 'x' as const,
        priced: false,
      }

      if (fixture.kind === 'hood') {
        const depth = Math.min(model.depth, config.depth)
        const bottom = surface + HOOD_CLEARANCE[hob ? hob.fuel : 'gas']
        out.push({
          ...common,
          position: { x: openCenter, y:bottom + model.height / 2, z: config.depth - depth / 2 },
          size: { x: width, y: model.height, z: depth },
        })
        return
      }

      // Столешница z = −overhang … D аралығында жатыр.
      const depth = Math.min(model.depth, config.depth + overhang - 60)
      out.push({
        ...common,
        position: { x: config.width / 2, y: surface + model.height / 2, z: (config.depth - overhang) / 2 },
        size: { x: width, y: model.height, z: depth },
      })
    })
  }

  return out
}
