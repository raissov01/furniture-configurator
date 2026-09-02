/**
 * Ящиктің САҢЫЛАУЛАРЫ мен ЖАНАМА ПЛАНКАЛАРЫ.
 *
 * Екеуі де qdesign-нің ящик терезесінен алынды (2026-09-03): «Саңылаулар»
 * бес санмен (аралық, сол, оң, жоғары, төмен) және «Планкалар» (сол/оң
 * жақта 16 мм).
 *
 * Ең маңыздысы — ЕСКІ жоба өзгермеуі керек: ештеңе берілмесе, есеп цехтың
 * бір ғана `frontGap`-ымен бұрынғыдай жүреді.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, generateCabinet } from '../src/core/index'
import type { CabinetConfig, Panel, SectionContent } from '../src/core/index'
import { CARCASS_THICKNESS as T, catalog, withCabinet } from './fixtures'

const cabinet = (content: Partial<Extract<SectionContent, { kind: 'drawers' }>> = {}): CabinetConfig =>
  withCabinet({
    height: 900, width: 800, depth: 500,
    sections: [{
      id: 's1', widthMode: 'flex',
      contents: [{ kind: 'drawers', count: 3, ...content }],
      fronts: null,
    }],
  })

const gen = (content = {}) => generateCabinet(cabinet(content), catalog)
const fronts = (panels: Panel[]) => panels.filter((p) => p.role === 'front')
  .sort((a, b) => a.position.y - b.position.y)

describe('саңылаулар', () => {
  it('берілмесе — ЕСКІ есеп, миллиметрі бірдей', () => {
    const plain = gen()
    const explicit = gen({ gaps: {} })
    expect(fronts(explicit).map((f) => [f.position.y, f.finishedLength]))
      .toEqual(fronts(plain).map((f) => [f.position.y, f.finishedLength]))
  })

  it('АРАЛЫҚ саңылау фасадтардың арасын өзгертеді', () => {
    const wide = fronts(gen({ gaps: { between: 10 } }))
    const gapBetween = wide[1]!.position.y - (wide[0]!.position.y + wide[0]!.finishedLength)
    expect(gapBetween).toBeGreaterThanOrEqual(10)
    // Саңылау өскенде фасад ТӨМЕНДЕЙДІ — жолақтың биіктігі сол күйінде.
    expect(wide[0]!.finishedLength).toBeLessThan(fronts(gen())[0]!.finishedLength)
  })

  it('ЖОҒАРЫ мен ТӨМЕН саңылаулары бөлек', () => {
    const panels = gen({ gaps: { bottom: 20, top: 2, between: 3 } })
    const list = fronts(panels)
    const band = 900 - 2 * T
    expect(list[0]!.position.y - T).toBeGreaterThanOrEqual(20)
    const topEdge = list[2]!.position.y + list[2]!.finishedLength
    expect(T + band - topEdge).toBeGreaterThanOrEqual(2)
  })

  it('СОЛ мен ОҢ саңылаулары фасадтың енін өзгертеді', () => {
    const plain = fronts(gen())[0]!
    const narrow = fronts(gen({ gaps: { left: 10, right: 10 } }))[0]!
    expect(narrow.finishedWidth).toBe(plain.finishedWidth - 2 * (10 - DEFAULT_SETTINGS.frontGap))
    expect(narrow.position.x).toBeGreaterThan(plain.position.x)
  })

  it('жолақ ӘРҚАШАН толық жабылады — астында түсініксіз саңылау қалмайды', () => {
    for (const gaps of [{}, { between: 8 }, { top: 1, bottom: 12 }, { between: 2, top: 2, bottom: 2 }]) {
      const list = fronts(gen({ gaps }))
      const band = 900 - 2 * T
      const used = list.reduce((sum, f) => sum + f.finishedLength, 0)
      const last = list[list.length - 1]!
      // Соңғы фасадтың үсті жолақтың шегінен шықпайды.
      expect(last.position.y + last.finishedLength).toBeLessThanOrEqual(T + band)
      expect(used).toBeLessThan(band)
    }
  })

  it('мағынасыз сан — ҚАТЕ', () => {
    expect(() => gen({ gaps: { between: 80 } })).toThrow(/0\.\.50/)
    expect(() => gen({ gaps: { left: -1 } })).toThrow(/0\.\.50/)
  })
})

describe('жанама планкалар', () => {
  const withFiller = gen({ fillers: { left: T } })
  const filler = (panels: Panel[]) => panels.filter((p) => p.label === 'Планка ящика')

  it('планка ДЕТАЛЬ болып шығады', () => {
    expect(filler(withFiller)).toHaveLength(1)
    expect(filler(gen())).toHaveLength(0)
    expect(filler(withFiller)[0]!.note).toContain('направляющую')
  })

  it('ұяны тарылтады: қорап тарырақ болады', () => {
    const width = (panels: Panel[]) => panels.find((p) => p.role === 'drawerBottom')!.finishedLength
    expect(width(withFiller)).toBe(width(gen()) - T)
  })

  it('ФАСАД тарылмайды — планка оның артында', () => {
    expect(fronts(withFiller)[0]!.finishedWidth).toBe(fronts(gen())[0]!.finishedWidth)
  })

  it('қалың планка ҚАБАТТАП жасалады', () => {
    const two = filler(gen({ fillers: { left: 2 * T } }))
    expect(two).toHaveLength(2)
    expect(two[0]!.note).toContain('слой 1 из 2')
    // Бір-бірінің үстінде емес, ҚАТАР тұр.
    expect(two[1]!.position.x).toBe(two[0]!.position.x + T)
  })

  it('екі жақта да болады, id-лері БІРЕГЕЙ', () => {
    const both = filler(gen({ fillers: { left: T, right: T } }))
    expect(both).toHaveLength(2)
    expect(new Set(both.map((p) => p.id)).size).toBe(2)
  })

  it('қалыңдыққа еселі емес сан — ҚАТЕ', () => {
    expect(() => gen({ fillers: { left: 20 } })).toThrow(/еселік/)
  })
})
