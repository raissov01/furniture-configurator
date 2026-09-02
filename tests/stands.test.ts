/**
 * Стойка — жолақтың ІШІНДЕГІ тік бөлгіш.
 *
 * Перегородка корпустың толық биіктігінде тұрады да, секцияларды бөледі.
 * Ал нағыз жиһазда жиі керегі — «төменде екі бөлік, жоғарыда бір»: оны тек
 * жолақтың ішіндегі стойка бере алады. Тест сол айырманы бекітеді.
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import type { CabinetConfig, Panel, SectionContent } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)

const build = (contents: SectionContent[]): Panel[] => {
  const config = base()
  return generateCabinet({
    ...config,
    sections: config.sections.map((s) => ({ ...s, contents })),
  }, SEED_CATALOG)
}

const stands = (panels: Panel[]): Panel[] => panels.filter((p) => p.label === 'Стойка')
const T = 16

describe('стойка', () => {
  it('панель болып шығады әрі деталировкаға түседі', () => {
    const panels = build([{ kind: 'stand', count: 1 }])
    expect(stands(panels)).toHaveLength(1)
    expect(stands(panels)[0]!.role).toBe('divider')
  })

  it('тік тұрады: ұзындығы — биіктік, қалыңдығы — X осі', () => {
    const stand = stands(build([{ kind: 'stand', count: 1 }]))[0]!
    expect(stand.orientation).toEqual({ length: 'y', width: 'z', thickness: 'x' })
    // Жолақ — корпустың ішкі биіктігі (2000 − 2×16 = 1968).
    expect(stand.finishedLength).toBe(base().height - 2 * T)
  })

  it('саны берілсе, ұяны ТЕҢ бөледі', () => {
    const list = stands(build([{ kind: 'stand', count: 2 }]))
    expect(list).toHaveLength(2)
    const xs = list.map((s) => s.position.x).sort((a, b) => a - b)
    // Екі стойка ұяны үшке бөледі: аралықтары бір-біріне жақын.
    const gap1 = xs[0]! - T
    const gap2 = xs[1]! - xs[0]! - T
    expect(Math.abs(gap1 - gap2)).toBeLessThanOrEqual(1)
  })

  it('нақты орын берілсе — ДӘЛ сонда тұрады', () => {
    const list = stands(build([{ kind: 'stand', count: 5, at: [100, 300] }]))
    expect(list).toHaveLength(2)
    const xs = list.map((s) => s.position.x)
    expect(xs[1]! - xs[0]!).toBe(200)
  })

  it('шегіністер биіктігі мен тереңдігін қысады', () => {
    const plain = stands(build([{ kind: 'stand', count: 1 }]))[0]!
    const inset = stands(build([{ kind: 'stand', count: 1, insets: { top: 100, bottom: 50, front: 30 } }]))[0]!
    expect(plain.finishedLength - inset.finishedLength).toBe(150)
    expect(plain.finishedWidth - inset.finishedWidth).toBe(30)
    expect(inset.position.y - plain.position.y).toBe(50)
    expect(inset.position.z - plain.position.z).toBe(30)
  })

  it('сөремен ҚАТАР тұра алады — нағыз тор осылай шығады', () => {
    // Бір жолақтың биіктігі берілмейді — ол қалғанын алады (`layoutBands`).
    const panels = build([
      { kind: 'shelves', count: 1, shelfKind: 'fixed', height: 800 },
      { kind: 'stand', count: 1 },
    ])
    expect(stands(panels)).toHaveLength(1)
    /*
     * Сөре ЕКЕУ: біреуі — жолақтың өз сөресі, екіншісі — ЖОЛАҚТАРДЫ бөлетін
     * панель (ядро оны `band-N-divider` деп жасайды). Яғни «төменде сөре,
     * жоғарыда стойка» деген тор осылай құралады.
     */
    const shelfPanels = panels.filter((p) => p.role === 'shelf')
    expect(shelfPanels).toHaveLength(2)
    expect(shelfPanels.some((p) => p.id.includes('band-1-divider'))).toBe(true)
  })

  it('жарамсыз сан мен шегініс ҚАТЕ береді', () => {
    expect(() => build([{ kind: 'stand', count: 0 }])).not.toThrow() // 0 — жай ғана стойкасыз
    expect(() => build([{ kind: 'stand', count: 11 }])).toThrow(/1\.\.10/)
    // Шек: әр жағы 0..1000 мм, ал қалдық стойка ≥ 20 мм болуы керек.
    expect(() => build([{ kind: 'stand', count: 1, insets: { top: 3000 } }])).toThrow(/0\.\.1000/)
    expect(() => build([{ kind: 'stand', count: 1, insets: { top: 980, bottom: 980 } }])).toThrow(/≥ 20 мм/)
    expect(() => build([{ kind: 'stand', count: 1, at: [100, 105] }])).toThrow(/кемінде/)
    expect(() => build([{ kind: 'stand', count: 1, at: [5000] }])).toThrow(/ұяның ені/)
  })

  it('кромкасы перегородканікімен бірдей: алдыңғы жиегі ғана көрінеді', () => {
    const stand = stands(build([{ kind: 'stand', count: 1 }]))[0]!
    expect(stand.edges.L1).not.toBeNull()
    expect(stand.edges.L2).toBeNull()
    expect(stand.edges.W1).toBeNull()
    expect(stand.edges.W2).toBeNull()
  })
})
