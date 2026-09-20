import { describe, expect, it } from 'vitest'
import { wallElevationOffset, wallElevationTarget } from '../lib/wallElevation'
import { DEFAULT_ROOM } from '../src/core/index'

/**
 * «Стена С/З/Ю/В» камерасының бағыты (docs/pro100/ui-design.md §4).
 *
 * Цех адамы браузерде «Стена С бос, ал Стена Ю ас үйді көрсетеді» деп
 * хабарлады (ас үй солтүстік қабырғада тұрса да). Бұл тест дәл сол
 * бағытты — камера СОЛ ҚАБЫРҒАНЫҢ ҚАРАМА-ҚАРСЫ ЖАҒЫНДА тұрып, СОЛ
 * ҚАБЫРҒАҒА ҚАРАУЫ керек екенін — сандық түрде бекітеді.
 *
 * Солтүстік қабырға Z=0 жазықтығында (`src/core/room.ts`), inward=(0,0,1).
 * Демек «Стена С» камерасы ҮЛКЕН Z-те (қабырғадан АЛЫС, оңтүстікке қарай)
 * тұруы керек — сонда ғана ол СОЛТҮСТІК қабырғаға (кіші Z) қарай алады.
 */
describe('wallElevationOffset — қабырға көрінісінің камера бағыты', () => {
  const room = DEFAULT_ROOM
  const distance = 5000

  it('Стена С (north, Z=0 жазықтығы): камера ҮЛКЕН Z-те — қабырғадан алыс', () => {
    const off = wallElevationOffset(room, 'north', distance)
    expect(off.z).toBeGreaterThan(0)
    expect(off.x).toBeCloseTo(0, 6)
  })

  it('Стена Ю (south, Z=depth жазықтығы): камера КІШІ (теріс) Z-те', () => {
    const off = wallElevationOffset(room, 'south', distance)
    expect(off.z).toBeLessThan(0)
    expect(off.x).toBeCloseTo(0, 6)
  })

  it('Стена В (east, X=width жазықтығы): камера КІШІ (теріс) X-те', () => {
    const off = wallElevationOffset(room, 'east', distance)
    expect(off.x).toBeLessThan(0)
    expect(off.z).toBeCloseTo(0, 6)
  })

  it('Стена З (west, X=0 жазықтығы): камера ҮЛКЕН X-те', () => {
    const off = wallElevationOffset(room, 'west', distance)
    expect(off.x).toBeGreaterThan(0)
    expect(off.z).toBeCloseTo(0, 6)
  })

  it('ұзындығы — берілген қашықтыққа тура тең (inward — бірлік вектор)', () => {
    for (const wallId of ['north', 'south', 'east', 'west'] as const) {
      const off = wallElevationOffset(room, wallId, distance)
      expect(Math.hypot(off.x, off.z)).toBeCloseTo(distance, 5)
    }
  })

  it('нысана — бөлме ортасы, көз деңгейінде', () => {
    const target = wallElevationTarget(room)
    expect(target).toEqual({ x: room.width / 2, y: room.height / 2, z: room.depth / 2 })
  })
})
