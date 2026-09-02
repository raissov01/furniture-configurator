/**
 * Крыша ПЛАНКА (царга) болғанда.
 *
 * Ас үй тумбасының үстінде столешница жатады, сондықтан тұтас крыша артық:
 * корпусты алдыңғы-артқы екі планка ұстайды. Бұл — «әдемі болсын» деген
 * баптау емес, ЖИНАЛУҒА әсер ететін шешім, сондықтан мұнда тексерілетіні:
 *   1. тұтас крыша тізімнен КЕТЕДІ, орнына планка келеді;
 *   2. ішкі биіктік ӨЗГЕРМЕЙДІ — фасад та, сөре де орнында қалады;
 *   3. присадка планкаға барады, ЖОҚ крышаға емес.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'
import { CARCASS_THICKNESS as T, catalog, withCabinet } from './fixtures'

const base = (extra: Partial<CabinetConfig> = {}): CabinetConfig =>
  withCabinet({
    height: 720, width: 600, depth: 500,
    sections: [{ id: 's1', widthMode: 'flex', contents: [{ kind: 'shelves', count: 1, shelfKind: 'adjustable' }], fronts: null }],
    ...extra,
  })

const gen = (extra: Partial<CabinetConfig> = {}) => generateCabinet(base(extra), catalog)
const ids = (panels: Panel[]) => panels.map((p) => p.id)
const byId = (panels: Panel[], id: string) => panels.find((p) => p.id === id)

describe('екі планка (алды + арты)', () => {
  const panels = gen({ topRails: { width: 100, count: 2 } })

  it('тұтас крыша ЖОҚ, орнына екі планка', () => {
    expect(byId(panels, 'top')).toBeUndefined()
    expect(ids(panels)).toContain('top-rail-front')
    expect(ids(panels)).toContain('top-rail-back')
  })

  it('планканың ұзындығы крышаның ұзындығымен БІРДЕЙ', () => {
    const plain = byId(gen(), 'top')!
    expect(byId(panels, 'top-rail-front')!.finishedLength).toBe(plain.finishedLength)
    expect(byId(panels, 'top-rail-front')!.finishedWidth).toBe(100)
  })

  it('алдыңғысы алдында, артқысы артта — қабаттаспайды', () => {
    const front = byId(panels, 'top-rail-front')!
    const back = byId(panels, 'top-rail-back')!
    expect(front.position.z).toBe(0)
    expect(back.position.z + 100).toBeLessThanOrEqual(base().depth)
    expect(back.position.z).toBeGreaterThanOrEqual(front.position.z + 100)
  })

  it('ІШКІ БИІКТІК өзгермейді: сөре мен фасад орнында қалады', () => {
    const shelfOf = (ps: Panel[]) => ps.find((p) => p.role === 'shelf')!
    const plainShelf = shelfOf(gen())
    const railShelf = shelfOf(panels)
    expect(railShelf.position.y).toBe(plainShelf.position.y)
    expect(railShelf.finishedLength).toBe(plainShelf.finishedLength)
  })

  it('материал ҮНЕМДЕЛЕДІ — бұл планканың басты мәні', () => {
    const area = (p: Panel) => p.cutLength * p.cutWidth
    const plain = area(byId(gen(), 'top')!)
    const rails = area(byId(panels, 'top-rail-front')!) + area(byId(panels, 'top-rail-back')!)
    expect(rails).toBeLessThan(plain)
  })

  it('екі планка да бүйірге КОНФИРМАТПЕН бекітіледі', () => {
    for (const id of ['top-rail-front', 'top-rail-back']) {
      const drills = byId(panels, id)!.drilling.filter((d) => d.purpose === 'confirmat')
      expect(drills.length, id).toBeGreaterThan(0)
    }
  })
})

describe('бір планка (тек арты)', () => {
  const panels = gen({ topRails: { width: 120, count: 1 } })

  it('алдыңғы планка ЖОҚ — мойка астында алды бос болуы керек', () => {
    expect(byId(panels, 'top-rail-front')).toBeUndefined()
    expect(byId(panels, 'top-rail-back')).toBeDefined()
  })
})

describe('«на ребро» тұрған планка', () => {
  const panels = gen({ topRails: { width: 80, count: 2, orientation: 'edge' } })

  it('ені ЖОҒАРЫ қарайды, қалыңдығы — тереңдікке', () => {
    const front = byId(panels, 'top-rail-front')!
    expect(front.orientation).toEqual({ length: 'x', width: 'y', thickness: 'z' })
    // Үстіңгі жиегі корпустың үстімен беттеседі.
    expect(front.position.y + front.finishedWidth).toBe(base().height)
    expect(front.rotation).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('артқысы арт жиекте тұрады', () => {
    const back = byId(panels, 'top-rail-back')!
    // Корпустың тереңдігі = крышаның ені; планканың қалыңдығы содан шегеріледі.
    const carcassDepth = byId(gen(), 'top')!.finishedWidth
    expect(back.position.z).toBe(carcassDepth - T)
  })
})

describe('тексерулер', () => {
  it('екі планка тереңдікке сыймаса — ҚАТЕ', () => {
    expect(() => gen({ topRails: { width: 300, count: 2 } })).toThrow(/глубина корпуса/)
    // Біреуі сыяды.
    expect(() => gen({ topRails: { width: 300, count: 1 } })).not.toThrow()
  })

  it('бүтін емес ені — ҚАТЕ', () => {
    expect(() => gen({ topRails: { width: 80.5, count: 2 } })).toThrow(/бүтін сан/)
  })
})

describe('үсті АШЫҚ корпус: жоқ крышаға тесік бұрғыланбайды', () => {
  it('бүйірдің торцінде «крышканың» саңылаулары қалмайды', () => {
    const open = gen({ openTop: true })
    const plain = gen()
    const sideHoles = (ps: Panel[]) => ps
      .filter((p) => p.role === 'side')
      .flatMap((p) => p.drilling)
      .filter((d) => d.purpose === 'confirmat').length
    // Крыша жоқ болса, бүйірдегі буын саңылаулары ЕКІ ЕСЕ аз (тек дно қалады).
    expect(sideHoles(open)).toBe(sideHoles(plain) / 2)
  })
})
