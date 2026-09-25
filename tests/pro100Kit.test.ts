import { describe, expect, it } from 'vitest'
import { defaultShopProfile } from '../src/core/shop'
import { PRO100_KIT_FORMAT, PRO100_TOLERANCE, pro100TestKit } from '../src/core/export/pro100Kit'

const kit = pro100TestKit(defaultShopProfile())

describe('PRO100 тест-жинағы', () => {
  it('төрт сценарий, пішімі мен шегі', () => {
    expect(kit.format).toBe(PRO100_KIT_FORMAT)
    expect(kit.version).toBe(1)
    expect(kit.tolerance).toBe(PRO100_TOLERANCE)
    expect(kit.scenarios.map((s) => s.id)).toEqual(['s1-base-600', 's2-wall-800', 's3-drawers-600', 's4-kitchen-2400'])
  })

  it('1-сценарий: 720 (H) × 600 (W) × 560 (D), 2 есік, 1 сөре', () => {
    const s1 = kit.scenarios[0]!
    const item = s1.items[0]!
    expect([item.height, item.width, item.depth]).toEqual([720, 600, 560])
    expect(item.ours).toMatchObject({ doors: 2, shelves: 1, drawers: 0 })
    expect(item.library.search[0]).toBe('Н 2дв 600')
    const side = s1.expected.parts.find((p) => p.role === 'side')!
    // §4.4: бүйір H, тереңдігі D − backAllowance (накладной арт 3 мм)
    expect([side.qty, side.finishedLength, side.finishedWidth]).toEqual([2, 720, 557])
    const front = s1.expected.parts.find((p) => p.role === 'front')!
    // §4.7: 714 × 295 готовый, 2 мм кромка төрт жақта → рез 710 × 291
    expect([front.qty, front.finishedLength, front.finishedWidth, front.cutLength, front.cutWidth]).toEqual([2, 714, 295, 710, 291])
    expect([front.edgeAlongLength, front.edgeAlongWidth]).toEqual([4, 4])
    expect(s1.expected.elements.find((e) => e.kind === 'shelfPin')?.qty).toBeGreaterThan(0)
  })

  it('2 және 3-сценарий: аспалы 800 (W) × 300 (D) және 3 ящик', () => {
    const [, s2, s3] = kit.scenarios
    expect(s2!.items[0]).toMatchObject({ width: 800, depth: 300, kind: 'wall', position: { bottom: 1400 } })
    expect(s2!.items[0]!.ours.doors).toBe(2)
    expect(s3!.items[0]!.ours.drawers).toBe(3)
    expect(s3!.expected.elements.some((e) => e.kind === 'runner')).toBe(true)
  })

  it('4-сценарий: 3 төменгі + 3 аспалы, қатар ені 2400 (W), қабаттаспайды', () => {
    const s4 = kit.scenarios[3]!
    const base = s4.items.filter((i) => i.kind === 'base')
    const wall = s4.items.filter((i) => i.kind === 'wall')
    expect(base.length).toBe(3)
    expect(wall.length).toBe(3)
    expect(base.reduce((s, i) => s + i.width, 0)).toBe(2400)
    expect(wall.reduce((s, i) => s + i.width, 0)).toBe(2400)
    expect(base.map((i) => i.position.left)).toEqual([0, 800, 1600])
    expect(new Set(s4.items.map((i) => i.id)).size).toBe(6)
    const sides = s4.expected.parts.filter((p) => p.role === 'side').reduce((s, p) => s + p.qty, 0)
    expect(sides).toBe(12)
  })

  it('барлық өлшем бүтін мм, ақша бүтін тиын', () => {
    for (const s of kit.scenarios) {
      for (const p of s.expected.parts) {
        for (const v of [p.finishedLength, p.finishedWidth, p.cutLength, p.cutWidth, p.thickness]) expect(Number.isInteger(v)).toBe(true)
      }
      for (const i of s.items) for (const v of [i.height, i.width, i.depth]) expect(Number.isInteger(v)).toBe(true)
      expect(Number.isInteger(s.expected.costs.total)).toBe(true)
      for (const m of s.expected.materials) expect(Number.isInteger(m.areaMm2)).toBe(true)
    }
  })

  it('JSON арқылы өзгеріссіз өтеді (Python көпірі оқиды)', () => {
    expect(JSON.parse(JSON.stringify(kit))).toEqual(kit)
  })
})
