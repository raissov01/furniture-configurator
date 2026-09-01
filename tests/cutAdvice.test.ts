/**
 * «Не помещается» дегеннен кейінгі кеңес.
 *
 * Тексерілетіні — сөздің әдемілігі емес, кеңестің ІСКЕ АСАТЫНЫ: айтылған
 * подрезкамен деталь шынымен сия ма, ұсынылған формат шынымен жете ме.
 * Сондықтан әр тест кеңесті оқып қана қоймай, оны ҚОЛДАНЫП көреді.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  findTemplate,
  generateCabinet,
  nestPanels,
  templateToCabinet,
  unplacedAdvice,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)

const tall = (height: number): Panel[] =>
  generateCabinet({ ...base(), height }, SEED_CATALOG)

describe('сыймаған детальға кеңес', () => {
  it('бәрі орналасса, кеңес те бос', () => {
    const panels = tall(2000)
    const nesting = nestPanels(panels, SEED_CATALOG)
    expect(nesting.unplaced).toEqual([])
    expect(unplacedAdvice(nesting, panels, SEED_CATALOG)).toEqual([])
  })

  it('подрезка ғана кедергі болса, қанша қылу керегін АЙТАДЫ', () => {
    // Парақ 2800 ұзын, подрезка 10 → пайдалысы 2780. 2790 мм бүйір сыймайды,
    // ал подрезканы 5 мм қылса — сияды.
    const panels = tall(2790)
    const options = { trimEdge: 10 }
    const nesting = nestPanels(panels, SEED_CATALOG, options)
    const advice = unplacedAdvice(nesting, panels, SEED_CATALOG, options)

    expect(advice.length).toBeGreaterThan(0)
    expect(advice[0]!.suggestions[0]).toMatch(/уменьшить обрезку с 10 до 5 мм/)

    // Кеңес ІСКЕ АСАДЫ: айтылған подрезкамен деталь орналасады.
    const retry = nestPanels(panels, SEED_CATALOG, { trimEdge: 5 })
    expect(retry.unplaced).toEqual([])
  })

  it('подрезкасыз да сыймаса, НАҚТЫ формат ұсынады', () => {
    const panels = tall(3000)
    const options = { trimEdge: 0 }
    const nesting = nestPanels(panels, SEED_CATALOG, options)
    const advice = unplacedAdvice(nesting, panels, SEED_CATALOG, options)

    expect(advice.length).toBeGreaterThan(0)
    const suggestion = advice[0]!.suggestions.find((s) => s.startsWith('подойдёт формат'))
    expect(suggestion).toBeDefined()
    // Ұсынылған формат детальден ҚЫСҚА болмауы керек.
    const [width, height] = suggestion!.match(/(\d+) × (\d+)/)!.slice(1).map(Number) as [number, number]
    const longest = Math.max(advice[0]!.cutLength, advice[0]!.cutWidth)
    expect(Math.max(width, height)).toBeGreaterThanOrEqual(longest)
  })

  it('ешбір стандарт парақ жетпесе, корпусты бөлуді айтады', () => {
    const panels = tall(3700)
    const nesting = nestPanels(panels, SEED_CATALOG)
    const advice = unplacedAdvice(nesting, panels, SEED_CATALOG)

    expect(advice.length).toBeGreaterThan(0)
    expect(advice[0]!.suggestions.join(' ')).toMatch(/разделите корпус/)
    expect(advice[0]!.suggestions.join(' ')).not.toMatch(/подойдёт формат/)
  })

  it('кеңесте детальдің де, парақтың да НАҚТЫ саны тұрады', () => {
    const panels = tall(3000)
    const options = { trimEdge: 12 }
    const nesting = nestPanels(panels, SEED_CATALOG, options)
    const [first] = unplacedAdvice(nesting, panels, SEED_CATALOG, options)

    expect(first).toBeDefined()
    expect(first!.trimEdge).toBe(12)
    expect(first!.usable.width).toBe(2800 - 24)
    expect(first!.usable.height).toBe(2070 - 24)
    expect(first!.cutLength).toBeGreaterThan(first!.usable.width)
    expect(first!.materialName).not.toBe('')
  })

  it('әр сыймаған детальға кемінде бір кеңес бар', () => {
    const panels = tall(3700)
    const nesting = nestPanels(panels, SEED_CATALOG)
    const advice = unplacedAdvice(nesting, panels, SEED_CATALOG)
    expect(advice).toHaveLength(nesting.unplaced.length)
    for (const a of advice) expect(a.suggestions.length).toBeGreaterThan(0)
  })
})
