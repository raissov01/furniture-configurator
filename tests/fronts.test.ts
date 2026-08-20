/**
 * CLAUDE.md §8.4 — фасад ені мен саңылаулар W-ға ДӘЛ жиналуы керек,
 * дөңгелектеу дрейфі болмауы тиіс, фасадтар әрқашан БІРДЕЙ.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, generateCabinet } from '../src/core/index.js'
import { CARCASS_THICKNESS as T, catalog, withCabinet } from './fixtures.js'

const gap = DEFAULT_SETTINGS.frontGap

function fronts(width: number, count: number, mount: 'overlay' | 'inset' = 'overlay') {
  const panels = generateCabinet(
    withCabinet({ width, fronts: { count, mount } }),
    catalog,
  )
  return panels.filter((p) => p.role === 'front')
}

describe('накладной фасад', () => {
  it('эталон 600 мм / 2 фасад → 295 мм, сол саңылау 4 мм', () => {
    const f = fronts(600, 2)
    expect(f.map((p) => p.finishedWidth)).toEqual([295, 295])
    expect(f[0]!.position.x).toBe(4) // қалдық 1 мм сыртқы саңылауға кетті
    expect(f[1]!.position.x).toBe(4 + 295 + 3)
    expect(f[0]!.finishedLength).toBe(2000 - 2 * gap)
  })

  it.each([400, 450, 600, 601, 900, 1197, 1200, 1801, 2400])(
    'W=%i: кез келген фасад саны үшін ені + саңылау = W дәл',
    (width) => {
      for (let n = 1; n <= 4; n += 1) {
        const f = fronts(width, n)
        const widths = new Set(f.map((p) => p.finishedWidth))
        expect(widths.size, `n=${n}: фасадтар бірдей емес`).toBe(1)

        const w = f[0]!.finishedWidth
        const leftGap = f[0]!.position.x
        const rightGap = width - (f[n - 1]!.position.x + w)
        const inner = f.slice(1).map((p, i) => p.position.x - (f[i]!.position.x + w))

        for (const g of [leftGap, rightGap, ...inner]) {
          expect(Number.isInteger(g)).toBe(true)
          expect(g).toBeGreaterThanOrEqual(gap) // ешбір саңылау номиналдан кіші емес
        }
        expect(leftGap + n * w + inner.reduce((a, b) => a + b, 0) + rightGap).toBe(width)
      }
    },
  )

  it('накладной фасад корпустың алдында тұрады (z теріс)', () => {
    const f = fronts(600, 2)
    expect(f[0]!.position.z).toBe(-16)
  })

  it('төрт жиегі де 2 мм кромка, рез екі өлшемнен 4 мм кіші', () => {
    const f = fronts(600, 2)[0]!
    expect(f.cutLength).toBe(f.finishedLength - 4)
    expect(f.cutWidth).toBe(f.finishedWidth - 4)
  })
})

describe('вкладной фасад', () => {
  it('ішкі саңылауға сыяды және корпустан шықпайды', () => {
    const f = fronts(600, 1, 'inset')[0]!
    expect(f.finishedWidth).toBe(600 - 2 * T - 2 * gap)
    expect(f.finishedLength).toBe(2000 - 2 * T - 2 * gap)
    expect(f.position.z).toBe(0)
    expect(f.position.x).toBeGreaterThanOrEqual(T)
  })
})

describe('сөре орналасуы', () => {
  it('4 сөре ішкі биіктікті бүтін миллиметрмен тең бөледі', () => {
    const panels = generateCabinet(withCabinet({}), catalog)
    const shelves = panels.filter((p) => p.role === 'shelf')
    expect(shelves.map((s) => s.position.y)).toEqual([397, 794, 1191, 1588])

    const openings = [
      shelves[0]!.position.y - T,
      ...shelves.slice(1).map((s, i) => s.position.y - (shelves[i]!.position.y + T)),
      2000 - T - (shelves[3]!.position.y + T),
    ]
    expect(openings.reduce((a, b) => a + b, 0)).toBe(2000 - 2 * T - 4 * T)
    expect(Math.max(...openings) - Math.min(...openings)).toBeLessThanOrEqual(1)
  })

  it('shelfSetback сөрені алдынан шегіндіреді, тереңдігін қысқартады', () => {
    const panels = generateCabinet(withCabinet({ settings: { shelfSetback: 20 } }), catalog)
    const shelf = panels.find((p) => p.role === 'shelf')!
    expect(shelf.finishedWidth).toBe(447 - 20)
    expect(shelf.position.z).toBe(20)
  })
})
