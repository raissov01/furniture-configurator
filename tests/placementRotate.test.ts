/**
 * МОДУЛЬДІҢ ЕРКІН БҰРЫЛЫСЫ.
 *
 * Бұрын шкаф тек қабырғаға тік тұратын (0/90/180/270). Бірақ бұрыштық ас
 * үйдің 45°-тық модулі, қиғаш қабырғаға тірелген шкаф — бәрі басқа бұрышта.
 *
 * ⚠ Бұрыш модульдің ӨЗ геометриясын өзгертпейді: деталировка да, раскрой да
 * бұдан тәуелсіз. Ол тек БӨЛМЕДЕГІ орны.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROOM, placementCorners, placementFootprint, placementPose,
  rectanglesOverlap, validatePlacements,
} from '../src/core/index'
import type { CabinetConfig, Placement } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const room = DEFAULT_ROOM
const cabinet = (id: string): CabinetConfig => ({
  ...withCabinet({
    height: 800, width: 600, depth: 500,
    sections: [{ id: 's1', widthMode: 'flex', contents: [], fronts: null }],
  }),
  id,
  name: id,
})

const place = (offset: number, rotate?: number): Placement => ({
  cabinetId: 'c', wall: 'south', offset, ...(rotate === undefined ? {} : { rotate }),
})

describe('бұрыш поза мен төртбұрышқа түседі', () => {
  it('қабырғаның бұрышына ҚОСЫЛАДЫ', () => {
    const plain = placementPose(room, cabinet('c'), place(0))
    const turned = placementPose(room, cabinet('c'), place(0, 45))
    expect(turned.rotationY).toBe(plain.rotationY + 45)
  })

  it('айналу нүктесі — корпустың локал басы, орны ЖЫЛЖЫМАЙДЫ', () => {
    const a = placementCorners(room, cabinet('c'), place(700))[0]!
    const b = placementCorners(room, cabinet('c'), place(700, 30))[0]!
    expect([Math.round(a.x), Math.round(a.z)]).toEqual([Math.round(b.x), Math.round(b.z)])
  })

  it('45°-та АЖШ КЕҢЕЙЕДІ — бұл дұрыс', () => {
    const plain = placementFootprint(room, cabinet('c'), place(0))
    const turned = placementFootprint(room, cabinet('c'), place(0, 45))
    expect(turned.width).toBeGreaterThan(plain.width)
    // 600×500 төртбұрыш 45°-та ені (600+500)/√2 ≈ 778 болады.
    expect(Math.round(turned.width)).toBe(Math.round((600 + 500) / Math.SQRT2))
  })

  it('90°-қа еселі бұрыштарда өлшем ДӘЛ бүтін қалады', () => {
    // cos(180°) −1 емес, −0.9999999999999999 болғандықтан «құйрық» шығатын.
    const fp = placementFootprint(room, cabinet('c'), { cabinetId: 'c', wall: 'north', offset: 0 })
    expect(fp.width).toBe(600)
    expect(fp.depth).toBe(500)
  })
})

describe('қабаттасу', () => {
  const entries = (a: Placement, b: Placement) => [
    { cabinet: cabinet('A'), placement: { ...a, cabinetId: 'A' } },
    { cabinet: cabinet('B'), placement: { ...b, cabinetId: 'B' } },
  ]
  const overlaps = (a: Placement, b: Placement) =>
    validatePlacements(room, entries(a, b)).some((i) => i.field === 'overlap')

  it('бұрылмаған екі шкаф бұрынғыдай тексеріледі', () => {
    expect(overlaps(place(0), place(300))).toBe(true)
    expect(overlaps(place(0), place(600))).toBe(false)
  })

  it('бұрылған шкаф қабырға бойымен КЕҢІРЕК орын алады', () => {
    /*
     * 600 × 500 шкаф 15°-қа бұрылғанда оның ең алыс бұрышы қабырға бойымен
     * 600·cos15 + 500·sin15 ≈ 709 мм-ге жетеді. Демек 600 мм-де тұрған көршісі
     * шынымен қабаттасады, ал 750 мм-де — жоқ. Ескі «аралық» тексерісі мұны
     * көрмейтін еді.
     */
    const reach = 600 * Math.cos(Math.PI / 12) + 500 * Math.sin(Math.PI / 12)
    expect(Math.round(reach)).toBe(709)
    expect(overlaps(place(0, 15), place(600, 15))).toBe(true)
    expect(overlaps(place(0, 15), place(750, 15))).toBe(false)
  })

  it('бұрылған шкаф НАҚТЫ төртбұрышпен тексеріледі', () => {
    // Қабырға бойындағы аралықпен қарасақ, 45°-та бұл екеуі «қабаттасар» еді.
    expect(overlaps(place(0, 45), place(1500))).toBe(false)
    // Ал шынымен бірінің үстіне бірі тұрса — табылады.
    expect(overlaps(place(0, 45), place(100, 45))).toBe(true)
  })
})

describe('SAT-тың өзі', () => {
  const rect = (x: number, z: number, w: number, d: number) => [
    { x, y: 0, z }, { x: x + w, y: 0, z }, { x: x + w, y: 0, z: z + d }, { x, y: 0, z: z + d },
  ]

  it('бөлек тұрғандар қиылыспайды', () => {
    expect(rectanglesOverlap(rect(0, 0, 100, 100), rect(200, 0, 100, 100))).toBe(false)
  })

  it('қабаттасқандар табылады', () => {
    expect(rectanglesOverlap(rect(0, 0, 100, 100), rect(50, 50, 100, 100))).toBe(true)
  })

  it('жиегі тиіп тұрғандар қиылыспайды', () => {
    expect(rectanglesOverlap(rect(0, 0, 100, 100), rect(100, 0, 100, 100))).toBe(false)
  })

  it('бұрылған төртбұрыш ромб болып қиылысады', () => {
    const diamond = [
      { x: 100, y: 0, z: 0 }, { x: 200, y: 0, z: 100 },
      { x: 100, y: 0, z: 200 }, { x: 0, y: 0, z: 100 },
    ]
    expect(rectanglesOverlap(diamond, rect(90, 90, 20, 20))).toBe(true)
    expect(rectanglesOverlap(diamond, rect(0, 0, 40, 40))).toBe(false)
  })
})

/**
 * Геометрия бөлмені МҮЛДЕ білмейді: `generateCabinet` placement алмайды,
 * сондықтан бұрыштың деталировкаға әсер етуі техникалық тұрғыдан мүмкін
 * емес. Оны тестпен «дәлелдеу» — бос жұмыс, сондықтан мұнда тест жоқ,
 * ал ереженің өзі CLAUDE.md §3-те тұр.
 */
