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

import { mergeSettings } from './constants'
import { findAppliance, findFilling } from './filling'
import { ConfigValidationError } from './errors'
import { layoutBands } from './generateCabinet'
import { layoutSections } from './sections'
import type { CabinetConfig, Catalog, SettingsOverride, Vec3 } from './types'

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
    // Әр 600 мм-ге бір жұп аяқ: кең корпус ортасынан майысады.
    const pairs = Math.max(2, Math.ceil(config.width / 600))
    out.push({
      kind: 'leg',
      priced: true,
      hardwareId: 'leg-100',
      label: 'Ножка регулируемая',
      qty: pairs * 2,
      length: 0,
      position: { x: config.width / 2, y: baseHeight / 2, z: config.depth / 2 },
      axis: 'x',
    })
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

  return out
}
