/**
 * Фасадтың зазорлары мен ашылу бағыты.
 *
 * Екеуі де «ұсақ» көрінеді, бірақ екеуі де ЦЕХТА көрінеді: зазор дұрыс
 * болмаса фасад жабылмайды, ал ілгектің жағы қате болса, чашка мен планка
 * әр басқа панельге бұрғыланады да, есік мүлде ілінбейді.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, FrontGaps, FrontOpening, Panel } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('wardrobe-2sec-1200')!, SEED_CATALOG)

const build = (patch: { gaps?: FrontGaps; opening?: FrontOpening }): Panel[] => {
  const config = base()
  return generateCabinet({
    ...config,
    sections: config.sections.map((s) => ({
      ...s,
      fronts: s.fronts ? { ...s.fronts, ...patch } : s.fronts,
    })),
  }, SEED_CATALOG)
}

const fronts = (panels: Panel[]): Panel[] => panels.filter((p) => p.role === 'front')
const cups = (panel: Panel) => panel.drilling.filter((d) => d.purpose === 'hinge' && d.face === 'inner')

describe('әр жақтың зазоры', () => {
  it('зазор берілмесе, нәтиже БҰРЫНҒЫДАЙ қалады', () => {
    expect(build({})).toEqual(generateCabinet(base(), SEED_CATALOG))
  })

  it('үст пен аст зазоры фасадтың биіктігін дәл сонша қысады', () => {
    const before = fronts(build({}))[0]!
    const after = fronts(build({ gaps: { top: 10, bottom: 4 } }))[0]!
    // Бұрын екі жағынан да 3 мм (әдепкі frontGap) еді.
    expect(before.finishedLength - after.finishedLength).toBe(10 + 4 - 3 - 3)
    // Астыңғы зазор өзгергендіктен фасад жоғары көтеріледі.
    expect(after.position.y - before.position.y).toBe(4 - 3)
  })

  it('фасадтар БІРДЕЙ қалады, айырма саңылауға сіңеді (§4.7)', () => {
    const list = fronts(build({ gaps: { between: 5, left: 2, right: 8 } }))
    const widths = new Set(list.map((f) => f.finishedWidth))
    expect(widths.size).toBe(1)
  })

  it('фасадтар мен саңылаулар ұяның еніне ДӘЛ жиналады', () => {
    const config = base()
    const panels = build({ gaps: { between: 5, left: 2, right: 8 } })
    const list = fronts(panels).filter((f) => f.id.startsWith('s1-'))
    const leftEdge = Math.min(...list.map((f) => f.position.x))
    const rightEdge = Math.max(...list.map((f) => f.position.x + f.finishedWidth))
    // Бір секцияның фасадтары ұясының ішінде қалады.
    expect(leftEdge).toBeGreaterThanOrEqual(0)
    expect(rightEdge).toBeLessThanOrEqual(config.width)
  })

  it('жарамсыз зазор ҚАТЕ береді', () => {
    expect(() => build({ gaps: { between: 80 } })).toThrow(/0\.\.50/)
    expect(() => build({ gaps: { left: -1 } })).toThrow(/0\.\.50/)
  })
})

describe('ашылу бағыты', () => {
  it('әдепкіде (auto) бірінші фасад солдан, соңғысы оңнан ашылады', () => {
    const list = fronts(build({ opening: 'auto' })).filter((f) => f.id.startsWith('s1-'))
    if (list.length < 2) return
    const first = cups(list[0]!)[0]!
    const last = cups(list[list.length - 1]!)[0]!
    expect(first.y).toBeLessThan(list[0]!.finishedWidth / 2)
    expect(last.y).toBeGreaterThan(list[list.length - 1]!.finishedWidth / 2)
  })

  it('«оңнан» дегенде ӘР фасадтың чашкасы оң жақта болады', () => {
    for (const front of fronts(build({ opening: 'right' }))) {
      for (const cup of cups(front)) {
        expect(cup.y).toBeGreaterThan(front.finishedWidth / 2)
      }
    }
  })

  it('«солдан» дегенде ӘР фасадтың чашкасы сол жақта болады', () => {
    for (const front of fronts(build({ opening: 'left' }))) {
      for (const cup of cups(front)) {
        expect(cup.y).toBeLessThan(front.finishedWidth / 2)
      }
    }
  })

  it('планка ілгектің ЖАҒЫНДАҒЫ панельге түседі', () => {
    const plates = (panels: Panel[], id: string) =>
      panels.find((p) => p.id === id)!.drilling.filter((d) => d.purpose === 'hinge')

    const leftOpen = build({ opening: 'left' })
    // Барлығы солдан ашылса, оң жақ бүйірде ілгектің планкасы болмауы керек.
    expect(plates(leftOpen, 'side-right')).toHaveLength(0)
    expect(plates(leftOpen, 'side-left').length).toBeGreaterThan(0)

    const rightOpen = build({ opening: 'right' })
    expect(plates(rightOpen, 'side-left')).toHaveLength(0)
    expect(plates(rightOpen, 'side-right').length).toBeGreaterThan(0)
  })

  it('чашка саны ешқашан жоғалмайды: әр фасадта ілгек бар', () => {
    for (const opening of ['auto', 'left', 'right'] as const) {
      for (const front of fronts(build({ opening }))) {
        expect(cups(front).length, opening).toBeGreaterThanOrEqual(2)
      }
    }
  })
})
