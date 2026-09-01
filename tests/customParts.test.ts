/**
 * Ерікті детальдар («Деталь»).
 *
 * Мұның мәні — УНИВЕРСАЛДЫЛЫҚ: параметрлі модель сипаттай алмайтын деталь
 * әрқашан табылады, ал оны цех өзі қоя алуы керек. Ең маңызды тексеру —
 * ондай деталь ҚАЛҒАНЫМЕН БІРДЕЙ жүруі: деталировкаға да, раскройға да,
 * сметаға да, DXF-ке де түседі. Егер біреуі оны көрмесе, цех оны кеспей
 * қалады да, жиһаз жиналмайды.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  cabinetToDxfFiles,
  defaultShopProfile,
  findTemplate,
  formatCutList,
  generateCabinet,
  nestPanels,
  parseProject,
  priceProject,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, CustomPart } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('desk-1200')!, SEED_CATALOG)

const shelfPart = (over: Partial<CustomPart> = {}): CustomPart => ({
  id: 'custom-1',
  label: 'Полка над столом',
  length: 1000,
  width: 250,
  position: { x: 100, y: 900, z: 50 },
  plane: 'horizontal',
  edging: 'front',
  ...over,
})

describe('ерікті деталь панельге айналады', () => {
  const config = { ...base(), customParts: [shelfPart()] }
  const panels = generateCabinet(config, SEED_CATALOG)
  const part = panels.find((p) => p.id === 'custom-1')!

  it('панельдер тізіміне қосылады әрі рөлі бөлек', () => {
    expect(part).toBeDefined()
    expect(part.role).toBe('custom')
    expect(part.label).toBe('Полка над столом')
    expect(panels).toHaveLength(generateCabinet(base(), SEED_CATALOG).length + 1)
  })

  it('готовый өлшемі берілгендей, рез өлшемі кромкамен есептеледі (§4.3)', () => {
    expect(part.finishedLength).toBe(1000)
    expect(part.finishedWidth).toBe(250)
    // «front» кромка — бір ұзын жиек, ол ЕНДІ азайтады (L1 → cutWidth).
    expect(part.cutLength).toBe(1000)
    expect(part.cutWidth).toBeLessThan(250)
    expect(part.edges.L1).not.toBeNull()
    expect(part.edges.L2).toBeNull()
  })

  it('жазықтық бағдарды анықтайды', () => {
    const planes = {
      horizontal: { length: 'x', width: 'z', thickness: 'y' },
      vertical: { length: 'y', width: 'z', thickness: 'x' },
      front: { length: 'y', width: 'x', thickness: 'z' },
    } as const
    for (const [plane, orientation] of Object.entries(planes)) {
      const [made] = generateCabinet(
        { ...base(), customParts: [shelfPart({ plane: plane as CustomPart['plane'] })] },
        SEED_CATALOG,
      ).filter((p) => p.id === 'custom-1')
      expect(made!.orientation, plane).toEqual(orientation)
    }
  })

  it('кромка таңдауы дәл сол күйінде қолданылады', () => {
    const all = generateCabinet({ ...base(), customParts: [shelfPart({ edging: 'all' })] }, SEED_CATALOG)
      .find((p) => p.id === 'custom-1')!
    expect(Object.values(all.edges).every((e) => e !== null)).toBe(true)

    const none = generateCabinet({ ...base(), customParts: [shelfPart({ edging: 'none' })] }, SEED_CATALOG)
      .find((p) => p.id === 'custom-1')!
    expect(Object.values(none.edges).every((e) => e === null)).toBe(true)
    expect(none.cutLength).toBe(none.finishedLength)
  })

  it('өз материалын ала алады', () => {
    const other = SEED_CATALOG.materials.find((m) => m.id !== base().carcassMaterialId)!
    const made = generateCabinet(
      { ...base(), customParts: [shelfPart({ materialId: other.id })] },
      SEED_CATALOG,
    ).find((p) => p.id === 'custom-1')!
    expect(made.materialId).toBe(other.id)
  })
})

describe('ерікті детальді БӘРІ көреді', () => {
  const config = { ...base(), customParts: [shelfPart()] }
  const panels = generateCabinet(config, SEED_CATALOG)

  it('деталировкада жеке жол болып тұрады', () => {
    const rows = formatCutList(panels, SEED_CATALOG)
    expect(rows.some((r) => r.name === 'Полка над столом')).toBe(true)
  })

  it('раскройға түседі', () => {
    const nesting = nestPanels(panels, SEED_CATALOG)
    const placed = nesting.byMaterial.flatMap((m) => m.sheets).flatMap((s) => s.parts)
    expect(placed.some((p) => p.panelId === 'custom-1')).toBe(true)
  })

  it('сметадағы материал мен кромка ҚЫМБАТТАЙДЫ', () => {
    const shop = {
      ...defaultShopProfile(),
      materials: defaultShopProfile().materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
      edgeBands: defaultShopProfile().edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
    }
    const catalog = { materials: shop.materials, edgeBands: shop.edgeBands }
    const without = generateCabinet(base(), catalog)
    const withPart = generateCabinet({ ...base(), customParts: [shelfPart()] }, catalog)

    const priceOf = (list: typeof panels) => priceProject(list, nestPanels(list, catalog), shop).total
    expect(priceOf(withPart)).toBeGreaterThan(priceOf(without))
  })

  it('DXF-те өз файлы болады', () => {
    expect(cabinetToDxfFiles(panels).has('custom-1.dxf')).toBe(true)
  })

  it('жоба файлында сақталады әрі қайта оқылады', () => {
    const project = {
      schemaVersion: 3 as const,
      name: 'Стол',
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [config],
      room: { width: 3000, depth: 3000, height: 2700 },
      placements: [{ cabinetId: config.id, wall: 'north' as const, offset: 0 }],
    }
    const parsed = parseProject(JSON.parse(JSON.stringify(project)))
    expect(parsed.cabinets[0]!.customParts![0]).toMatchObject({ id: 'custom-1', plane: 'horizontal' })
  })
})

describe('ерікті детальдің шектеулері', () => {
  it('id қайталанса — ҚАТЕ, үнсіз алмастырылмайды', () => {
    expect(() => generateCabinet(
      { ...base(), customParts: [shelfPart({ id: 'side-left' })] },
      SEED_CATALOG,
    )).toThrow(/id қайталанды/)
  })

  it('екі деталь бір id-мен тұра алмайды', () => {
    expect(() => generateCabinet(
      { ...base(), customParts: [shelfPart(), shelfPart()] },
      SEED_CATALOG,
    )).toThrow(/id қайталанды/)
  })

  it('тар деталь РҰҚСАТ (царга 80 мм), ал 10 мм — ҚАТЕ', () => {
    expect(() => generateCabinet(
      { ...base(), customParts: [shelfPart({ width: 80 })] },
      SEED_CATALOG,
    )).not.toThrow()
    expect(() => generateCabinet(
      { ...base(), customParts: [shelfPart({ width: 10 })] },
      SEED_CATALOG,
    )).toThrow(/20\.\.4000/)
  })

  it('бүтін емес өлшем ҚАТЕ (§0.2)', () => {
    expect(() => generateCabinet(
      { ...base(), customParts: [shelfPart({ length: 999.5 })] },
      SEED_CATALOG,
    )).toThrow(/бүтін сан емес/)
  })

  it('жоқ материал ҚАТЕ', () => {
    expect(() => generateCabinet(
      { ...base(), customParts: [shelfPart({ materialId: 'нет-такого' })] },
      SEED_CATALOG,
    )).toThrow(/материал/)
  })

  it('деталь жоқ болса, корпус бұрынғыдай қалады', () => {
    expect(generateCabinet({ ...base(), customParts: [] }, SEED_CATALOG))
      .toEqual(generateCabinet(base(), SEED_CATALOG))
  })
})
