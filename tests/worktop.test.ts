/**
 * СТОЛЕШНИЦА — әр қабырғаға тұтас тақта (qdesign сияқты, 09-13).
 *
 * Тексерілетіні: генератор тумбалардың әр үздіксіз тобына БІР постформинг
 * тақта қояды (корпустарда `shared`), бұрышта көрші тақта негізгіге тіреледі,
 * бағана топты бөледі, ұзын қабырғада түйіспе модульдің шекарасында.
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, generateCabinet, generateKitchen, nestPanels } from '../src/core/index'
import type { CabinetConfig, CustomPart } from '../src/core/index'

type Result = ReturnType<typeof generateKitchen>

const worktopParts = (r: Result) =>
  r.cabinets.flatMap((c) => (c.customParts ?? []).filter((p) => p.label === 'Столешница').map((part) => ({ c, part })))

/** Қабырғадағы столешницасы бар тумбалардың енінің қосындысы. */
const lowerSpan = (r: Result, wall: string, pred: (c: CabinetConfig) => boolean = () => true) =>
  r.placements
    .filter((p) => p.wall === wall && !(p.elevation ?? 0))
    .map((p) => r.cabinets.find((c) => c.id === p.cabinetId)!)
    .filter((c) => c.worktop && pred(c))
    .reduce((sum, c) => sum + c.width, 0)

describe('столешница — қабырғаға тұтас тақта', () => {
  const corner = generateKitchen({ layout: 'corner', lengthA: 3200, lengthB: 2400, sink: true, upper: true }, SEED_CATALOG)

  it('Г-кухня: солтүстікте бір тұтас тақта, шығыстағысы оған тіреледі (шығыңқыға қысқа)', () => {
    const parts = worktopParts(corner)
    const byWall = (wall: string) => parts.filter(({ c }) =>
      corner.placements.find((p) => p.cabinetId === c.id)!.wall === wall)
    expect(byWall('north')).toHaveLength(1)
    expect(byWall('east')).toHaveLength(1)
    const north = byWall('north')[0]!.part
    const east = byWall('east')[0]!.part
    expect(north.length).toBe(lowerSpan(corner, 'north'))
    const overhang = byWall('east')[0]!.c.worktop!.overhangFront
    expect(east.length).toBe(lowerSpan(corner, 'east') - overhang)
    // Тереңдігі — тумба + алдыңғы шығыңқы, генераторсыз столешницамен бірдей.
    expect(north.width).toBe(byWall('north')[0]!.c.depth + overhang)
  })

  it('тумбаларда ортақ столешница (өз детальі жоқ), материал — постформинг тақта', () => {
    const slab = SEED_CATALOG.materials.find((m) => m.slab)!.id
    const lowers = corner.cabinets.filter((c) => c.worktop)
    expect(lowers.length).toBeGreaterThan(3)
    for (const c of lowers) {
      expect(c.worktop!.shared).toBe(true)
      expect(c.worktop!.materialId).toBe(slab)
      // Тумбаның өз «worktop» детальі жоқ — тек топ басындағы ерікті деталь.
      expect(generateCabinet(c, SEED_CATALOG).some((p) => p.id === 'worktop')).toBe(false)
    }
    // Бүкіл жобаның детальдері: столешница раскройға кірмейді.
    const panels = corner.cabinets.flatMap((c) => generateCabinet(c, SEED_CATALOG))
    const worktops = panels.filter((p) => p.label === 'Столешница')
    expect(worktops).toHaveLength(2)
    expect(worktops.every((p) => p.materialId === slab)).toBe(true)
    expect(nestPanels(panels, SEED_CATALOG).byMaterial.some((g) => g.materialId === slab)).toBe(false)
  })

  it('түзу кухня: бағана тақтаны бөледі, тумбалардың үстінде бір тақта', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 4200, sink: true, upper: true, appliances: true }, SEED_CATALOG)
    const parts = worktopParts(r).map(({ part }) => part)
    expect(parts).toHaveLength(1)
    expect(parts[0]!.length).toBe(lowerSpan(r, 'north'))
    // Бағаналардың (биік) өзінде столешница жоқ.
    expect(r.cabinets.filter((c) => c.height > 1500).every((c) => !c.worktop)).toBe(true)
  })

  it('ұзын қабырға: бір тақта 4000-нан аспайды, түйіспе модульдің шекарасында', () => {
    const r = generateKitchen({ layout: 'straight', lengthA: 7000, sink: false, upper: false, appliances: false }, SEED_CATALOG)
    const parts: CustomPart[] = worktopParts(r).map(({ part }) => part)
    expect(parts.length).toBeGreaterThanOrEqual(2)
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(4000)
    expect(parts.reduce((sum, p) => sum + p.length, 0)).toBe(lowerSpan(r, 'north'))
    for (const c of r.cabinets) expect(() => generateCabinet(c, SEED_CATALOG)).not.toThrow()
  })
})
