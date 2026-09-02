/**
 * Сөренің орналасуы: шегіністер мен НАҚТЫ биіктіктер.
 *
 * Тең тарату — дұрыс әдепкі, бірақ ыдыс-аяқ пен кітаптың биіктігі әртүрлі.
 * Ал шегініс — сөре ұяны әрқашан толық алмайтындықтан керек. Екеуі де
 * детальдің НАҚТЫ өлшемін өзгертеді, сондықтан деталировкаға да, раскройға
 * да тікелей әсер етеді.
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import type { CabinetConfig, Panel, SectionContent } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)

const withShelves = (content: Partial<Extract<SectionContent, { kind: 'shelves' }>>): Panel[] => {
  const config = base()
  return generateCabinet({
    ...config,
    sections: config.sections.map((s) => ({
      ...s,
      contents: s.contents.map((c) => (c.kind === 'shelves' ? { ...c, ...content } : c)),
    })),
  }, SEED_CATALOG)
}

const shelves = (panels: Panel[]): Panel[] => panels.filter((p) => p.role === 'shelf')

describe('шегіністер', () => {
  it('берілмесе — бәрі бұрынғыдай', () => {
    expect(withShelves({})).toEqual(generateCabinet(base(), SEED_CATALOG))
  })

  it('сол мен оң шегініс сөренің ЕНІН қысады', () => {
    const before = shelves(withShelves({}))[0]!
    const after = shelves(withShelves({ insets: { left: 20, right: 30 } }))[0]!
    expect(before.finishedLength - after.finishedLength).toBe(50)
    expect(after.position.x - before.position.x).toBe(20)
  })

  it('алдыңғы шегініс сөрені АРТҚА жылжытады әрі тереңдігін қысады', () => {
    const before = shelves(withShelves({}))[0]!
    const after = shelves(withShelves({ insets: { front: 40 } }))[0]!
    expect(before.finishedWidth - after.finishedWidth).toBe(40)
    expect(after.position.z - before.position.z).toBe(40)
  })

  it('арт шегініс тереңдікті қысады, орнын жылжытпайды', () => {
    const before = shelves(withShelves({}))[0]!
    const after = shelves(withShelves({ insets: { back: 25 } }))[0]!
    expect(before.finishedWidth - after.finishedWidth).toBe(25)
    expect(after.position.z).toBe(before.position.z)
  })

  it('рез өлшемі де бірге өзгереді (§4.3 ережесімен)', () => {
    const shelf = shelves(withShelves({ insets: { left: 20, right: 20 } }))[0]!
    expect(shelf.cutLength).toBeLessThanOrEqual(shelf.finishedLength)
    expect(shelf.finishedLength).toBe(shelves(withShelves({}))[0]!.finishedLength - 40)
  })

  it('тым үлкен шегініс ҚАТЕ береді, үнсіз кішірейтпейді', () => {
    expect(() => withShelves({ insets: { left: 400, right: 400 } })).toThrow(/≥ 20 мм/)
    expect(() => withShelves({ insets: { left: -5 } })).toThrow(/0\.\.1000/)
  })
})

describe('нақты биіктіктер', () => {
  it('«at» берілсе, сөре ДӘЛ сол биіктікте тұрады', () => {
    const list = shelves(withShelves({ at: [300, 800, 1300] }))
    expect(list).toHaveLength(3)
    // Жолақ корпустың ішінде басталады (дноның үстінде), сондықтан
    // салыстыру бірінші сөренің биіктігіне қатысты жүреді.
    const base0 = list[0]!.position.y - 300
    expect(list.map((s) => s.position.y - base0)).toEqual([300, 800, 1300])
  })

  it('«at» саны `count`-тан басым', () => {
    expect(shelves(withShelves({ count: 4, at: [500] }))).toHaveLength(1)
  })

  it('реті бұзылса не жақындап кетсе — ҚАТЕ', () => {
    expect(() => withShelves({ at: [500, 400] })).toThrow(/кемінде/)
    expect(() => withShelves({ at: [500, 505] })).toThrow(/кемінде/)
  })

  it('жолақтан шығып кетсе — ҚАТЕ', () => {
    expect(() => withShelves({ at: [5000] })).toThrow(/жолақтың биіктігі/)
    expect(() => withShelves({ at: [-10] })).toThrow(/бүтін сан/)
  })

  it('бос тізім — ҚАТЕ (сөресіз болса, `count: 0` бар)', () => {
    expect(() => withShelves({ at: [] })).toThrow(/кемінде бір/)
  })

  it('нақты биіктіктегі сөре де полкодержательге бұрғыланады', () => {
    const panels = withShelves({ at: [400, 900] })
    const side = panels.find((p) => p.id === 'side-left')!
    expect(side.drilling.filter((d) => d.purpose === 'shelfPin').length).toBeGreaterThan(0)
  })
})
