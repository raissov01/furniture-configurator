/**
 * Панель ЕМЕС фурнитура: штанга.
 *
 * Басты талап: ол деталировкаға да, раскройға да ТҮСПЕУІ керек — парақтан
 * кесілмейді, сатып алынады. Бірақ сметада да, 3D-де де болуы тиіс.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SEED_CATALOG,
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  generateHardware,
  nestPanels,
  priceProject,
  templateToCabinet,
} from '../src/core/index'
import type { Panel, ShopProfile } from '../src/core/index'

const catalog = SEED_CATALOG
const withRod = templateToCabinet(findTemplate('wardrobe-rod-1000')!, catalog)
const noRod = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

describe('штанга', () => {
  it('штангасы бар секцияда штанга мен екі ұстағыш шығады', () => {
    const hardware = generateHardware(withRod, catalog)
    expect(hardware.filter((h) => h.kind === 'rod')).toHaveLength(1)
    expect(hardware.find((h) => h.kind === 'rodBracket')!.qty).toBe(2)
  })

  it('штангасыз шкафта фурнитура да жоқ', () => {
    expect(generateHardware(noRod, catalog)).toEqual([])
  })

  it('штанга ДЕТАЛИРОВКАҒА түспейді — ол кесілмейді', () => {
    const panels = generateCabinet(withRod, catalog)
    expect(panels.some((p: Panel) => p.label.toLowerCase().includes('штанга'))).toBe(false)
  })

  it('ұзындығы секцияның ішкі енімен бірдей', () => {
    const rod = generateHardware(withRod, catalog).find((h) => h.kind === 'rod')!
    const t = catalog.materials.find((m) => m.id === withRod.carcassMaterialId)!.thickness
    expect(rod.length).toBe(withRod.width - 2 * t)
  })

  it('штанга жолақтың ҮСТІҢГІ бөлігінде, шкафтың ішінде тұрады', () => {
    const rod = generateHardware(withRod, catalog).find((h) => h.kind === 'rod')!
    expect(rod.position.y).toBeLessThan(withRod.height)
    expect(rod.position.y).toBeGreaterThan(withRod.height / 2)
    expect(rod.position.z).toBeGreaterThan(0)
    expect(rod.position.z).toBeLessThan(withRod.depth)
  })
})

describe('штанга сметада', () => {
  const shop: ShopProfile = (() => {
    const base = defaultShopProfile()
    return {
      ...base,
      materials: base.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
      edgeBands: base.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
      hardware: base.hardware.map((h) => ({ ...h, pricePerUnit: 60000 })),
    }
  })()

  it('штанга МЕТРМЕН, ұстағыш данамен есептеледі', () => {
    const panels = generateCabinet(withRod, catalog)
    const price = priceProject(panels, nestPanels(panels, catalog), shop, generateHardware(withRod, catalog))
    const rod = price.hardware.find((l) => l.id === 'rod-25')!
    const bracket = price.hardware.find((l) => l.id === 'rod-bracket')!
    expect(rod.unit).toBe('м')
    expect(rod.qty).toBeCloseTo(0.97, 1)
    expect(bracket.unit).toBe('шт')
    expect(bracket.qty).toBe(2)
  })

  it('фурнитура берілмесе, смета бұрынғыдай жиналады', () => {
    const panels = generateCabinet(noRod, catalog)
    const price = priceProject(panels, nestPanels(panels, catalog), shop)
    expect(price.hardware.some((l) => l.id === 'rod-25')).toBe(false)
  })
})

describe('купе есіктері', () => {
  const kupe = templateToCabinet(findTemplate('wardrobe-sliding-1800')!, catalog)
  const panels = generateCabinet(kupe, catalog)

  it('деталировкаға тек ВСТАВКА түседі, профиль емес', () => {
    const doors = panels.filter((p: Panel) => p.label.includes('купе'))
    expect(doors).toHaveLength(2)
    for (const d of doors) expect(d.label).toContain('Вставка')
    expect(panels.some((p: Panel) => p.label.toLowerCase().includes('профиль'))).toBe(false)
  })

  it('есіктер бір-бірін жабады: жалпы ені корпустан АРТЫҚ', () => {
    const doors = panels.filter((p: Panel) => p.label.includes('купе'))
    const total = doors.reduce((sum, d) => sum + d.finishedWidth, 0)
    // Вставка профильден тар, сондықтан есіктің толық енін қалпына келтіреміз.
    const doorWidth = doors[0]!.finishedWidth + 2 * DEFAULT_SETTINGS.slidingProfileSide
    expect(doorWidth * doors.length).toBeGreaterThan(kupe.width)
    expect(total).toBeGreaterThan(0)
  })

  it('есіктер сатылы тұрады — екі рельсте', () => {
    const doors = panels.filter((p: Panel) => p.label.includes('купе'))
    const depths = new Set(doors.map((d) => d.position.z))
    expect(depths.size).toBe(2)
  })

  it('рельс пен ролик жиынтығы фурнитурада', () => {
    const hardware = generateHardware(kupe, catalog)
    expect(hardware.find((h) => h.kind === 'slidingTrack')!.qty).toBe(2)
    expect(hardware.find((h) => h.kind === 'slidingDoorKit')!.qty).toBe(2)
  })

  it('купе мен ілмелі фасад бір корпуста болмайды', () => {
    const broken = {
      ...kupe,
      sections: kupe.sections.map((s) => ({ ...s, fronts: { count: 1, mount: 'overlay' as const } })),
    }
    expect(() => generateCabinet(broken, catalog)).toThrow(/купе|одновременно/)
  })

  it('есік саны 2..4 аралығында', () => {
    expect(() => generateCabinet({ ...kupe, sliding: { count: 1 } }, catalog)).toThrow(/sliding.count/)
    expect(() => generateCabinet({ ...kupe, sliding: { count: 9 } }, catalog)).toThrow(/sliding.count/)
  })
})

describe('цоколь, ножки, столешница', () => {
  const full = templateToCabinet(findTemplate('kitchen-base-full-600')!, catalog)
  const panels = generateCabinet(full, catalog)

  it('корпус цокольдің ҮСТІНДЕ тұрады', () => {
    const bottom = panels.find((p: Panel) => p.role === 'bottom')!
    const plinth = panels.find((p: Panel) => p.role === 'plinth')!
    expect(plinth.position.y).toBe(0)
    expect(bottom.position.y).toBe(full.base!.height)
  })

  it('столешница корпустан алға шығып тұр', () => {
    const worktop = panels.find((p: Panel) => p.label === 'Столешница')!
    expect(worktop.position.z).toBe(-full.worktop!.overhangFront)
    expect(worktop.finishedWidth).toBe(full.depth + full.worktop!.overhangFront)
  })

  it('тіректің биіктігі шектен шықса — түсінікті қате', () => {
    expect(() => generateCabinet({ ...full, base: { kind: 'plinth', height: 5 } }, catalog))
      .toThrow(/base.height/)
  })

  it('ножки таңдалса — цоколь ДЕТАЛІ болмайды, фурнитура болады', () => {
    const onLegs = { ...full, base: { kind: 'legs' as const, height: 100 } }
    expect(generateCabinet(onLegs, catalog).some((p: Panel) => p.role === 'plinth')).toBe(false)
    const legs = generateHardware(onLegs, catalog).find((h) => h.kind === 'leg')!
    expect(legs.qty).toBeGreaterThanOrEqual(4)
  })

  it('кең корпусқа аяқ көбірек керек', () => {
    const wide = { ...full, width: 1800, base: { kind: 'legs' as const, height: 100 } }
    const narrow = { ...full, width: 600, base: { kind: 'legs' as const, height: 100 } }
    const qty = (c: typeof wide) => generateHardware(c, catalog).find((h) => h.kind === 'leg')!.qty
    expect(qty(wide)).toBeGreaterThan(qty(narrow))
  })

  it('тіректе тұрған шкафта полкодержатель тесіктері де көтеріледі', () => {
    const raised = panels.find((p: Panel) => p.role === 'side')!
    // Тесіктер панельдің ІШІНДЕ қалуы керек: теріс координата болмайды.
    for (const d of raised.drilling) expect(d.x).toBeGreaterThanOrEqual(0)
  })
})
