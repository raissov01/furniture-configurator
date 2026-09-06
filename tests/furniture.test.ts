/**
 * Жиһаз генераторы (көп түр): шкаф, комод, ТВ аймақ.
 *
 * Тексерілетіні: корпустар жиналады, бөлмеге сыяды, қабаттаспайды (бұрыш та).
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, generateCabinet, generateFurniture, validatePlacements } from '../src/core/index'
import type { FurnitureType } from '../src/core/index'

const entriesOf = (r: ReturnType<typeof generateFurniture>) =>
  r.cabinets.map((cabinet) => ({
    cabinet,
    placement: r.placements.find((p) => p.cabinetId === cabinet.id)!,
  }))

describe('generateFurniture', () => {
  it.each(['wardrobe', 'chest'] as FurnitureType[])('%s: түзу — жиналады әрі сыяды', (type) => {
    const r = generateFurniture({ type, layout: 'straight', lengthA: 3000 }, SEED_CATALOG)
    expect(r.cabinets.length).toBeGreaterThan(1)
    for (const c of r.cabinets) expect(() => generateCabinet(c, SEED_CATALOG)).not.toThrow()
    expect(validatePlacements(r.room, entriesOf(r))).toEqual([])
  })

  it.each(['wardrobe', 'chest'] as FurnitureType[])('%s: бұрыш — қабаттаспайды', (type) => {
    const r = generateFurniture({ type, layout: 'corner', lengthA: 3000, lengthB: 2400 }, SEED_CATALOG)
    expect(new Set(r.placements.map((p) => p.wall))).toEqual(new Set(['north', 'east']))
    expect(validatePlacements(r.room, entriesOf(r))).toEqual([])
  })

  it('ТВ аймақ: екі бағана + тумба + ілмелі шкаф', () => {
    const r = generateFurniture({ type: 'tv', layout: 'straight', lengthA: 3000 }, SEED_CATALOG)
    expect(r.cabinets).toHaveLength(4)
    // Ілмелі шкаф еденнен биік тұр.
    expect(r.placements.some((p) => (p.elevation ?? 0) > 0)).toBe(true)
    for (const c of r.cabinets) expect(() => generateCabinet(c, SEED_CATALOG)).not.toThrow()
  })

  it('материал бүкіл модульге қолданылады', () => {
    const front = SEED_CATALOG.materials[1]!.id
    const r = generateFurniture({ type: 'wardrobe', layout: 'straight', lengthA: 2400, materials: { frontId: front } }, SEED_CATALOG)
    expect(r.cabinets.every((c) => c.frontMaterialId === front)).toBe(true)
  })

  it('ас үй — kitchen.ts-ке бағытталады (мойка/столешница бар)', () => {
    const r = generateFurniture({ type: 'kitchen', layout: 'straight', lengthA: 3000, sink: true }, SEED_CATALOG)
    expect(r.cabinets.some((c) => c.worktop)).toBe(true)
  })
})
