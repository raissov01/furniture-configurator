/**
 * CLAUDE.md §8.4 — фасад ені мен саңылаулар W-ға ДӘЛ жиналуы керек,
 * дөңгелектеу дрейфі болмауы тиіс, фасадтар әрқашан БІРДЕЙ.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, distributeMillimetres, gapFillOrder, generateCabinet } from '../src/core/index'
import { CARCASS_THICKNESS as T, catalog, oneSection, threeSectionWardrobe, withCabinet } from './fixtures'

const gap = DEFAULT_SETTINGS.frontGap

function fronts(width: number, count: number, mount: 'overlay' | 'inset' = 'overlay') {
  const panels = generateCabinet(
    withCabinet({ width, sections: oneSection({ fronts: { count, mount } }) }),
    catalog,
  )
  return panels.filter((p) => p.role === 'front')
}

describe('накладной фасад', () => {
  it.each([1, 2, 3, 4])('n=%i: §4.7 қалдығы алдымен сыртқы, кейін ішкі саңылауға түседі', (n) => {
    const width = 610
    const frontWidth = Math.floor((width - (n + 1) * gap) / n)
    const leftover = width - n * frontWidth - (n + 1) * gap
    const extra = distributeMillimetres(leftover, n + 1, gapFillOrder(n + 1))
    const gaps = extra.map((value) => value + gap)
    expect(gaps.reduce((sum, value) => sum + value, 0) + n * frontWidth).toBe(width)
    expect(gaps[0]).toBeGreaterThanOrEqual(gaps.at(-1)!)
    expect(gaps.at(-1)).toBeGreaterThanOrEqual(Math.max(...gaps.slice(1, -1)))
    if (n === 4) expect(gaps[1]).toBe(gap + 1)
  })

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
      // Бір секцияда тек екі қарсы жаққа ілінетін есікке тік тірек бар.
      for (let n = 1; n <= 2; n += 1) {
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
    const f = generateCabinet(withCabinet({
      width: 600,
      settings: { shelfSetback: 20 },
      sections: oneSection({ fronts: { count: 1, mount: 'inset' } }),
    }), catalog).find((panel) => panel.role === 'front')!
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

describe('көп секциялы фасад ұялары', () => {
  const panels = generateCabinet(threeSectionWardrobe, catalog)
  const f = panels.filter((p) => p.role === 'front')

  it('фасадтар кабинеттің бүкіл алдын жабады, W-ға дәл жиналады', () => {
    const sorted = [...f].sort((a, b) => a.position.x - b.position.x)
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!
    expect(first.position.x).toBeGreaterThanOrEqual(gap)
    expect(last.position.x + last.finishedWidth).toBeLessThanOrEqual(1800 - gap)
    for (let i = 1; i < sorted.length; i += 1) {
      const clearance = sorted[i]!.position.x - (sorted[i - 1]!.position.x + sorted[i - 1]!.finishedWidth)
      expect(clearance).toBeGreaterThanOrEqual(gap)
    }
  })

  it('бір ұядағы фасадтар бірдей', () => {
    const bySection = new Map<string, number[]>()
    for (const p of f) {
      const key = p.id.split('-front-')[0]!
      bySection.set(key, [...(bySection.get(key) ?? []), p.finishedWidth])
    }
    for (const [key, widths] of bySection) {
      expect(new Set(widths).size, `${key}: бірдей емес`).toBe(1)
    }
  })

  it('шеткі ұя боковинаны толық жабады, ортаңғысы перегородканы бөліседі', () => {
    // s2 мен s3 секцияларының ені бірдей (668), бірақ оң шеткі ұя боковинаны
    // ТОЛЫҚ алады (16), ал ортаңғысы екі жарты перегородка (8+8) алады —
    // сондықтан фасадтары 4 мм-ге өзгеше. Бұл әдейі: фасад алдындағы бүкіл
    // бетті жабуы керек.
    const s2 = f.find((p) => p.id.startsWith('s2-'))!
    const s3 = f.find((p) => p.id.startsWith('s3-'))!
    expect(s2.finishedWidth).toBe(337)
    expect(s3.finishedWidth).toBe(341)
  })
})
