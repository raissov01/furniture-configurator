/**
 * CLAUDE.md §8.5 — присадка 32 мм торына түсуі және 37 мм шегінісі.
 * §4.9-дың қалған ережелері де осында тексеріледі.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet, hingeCount, spreadAlongJoint } from '../src/core/index'
import type { Drill, Panel } from '../src/core/index'
import { CARCASS_THICKNESS as T, catalog, referenceWardrobe, threeSectionWardrobe, withCabinet } from './fixtures'

const panels = generateCabinet(referenceWardrobe, catalog)
const byId = (id: string): Panel => panels.find((p) => p.id === id)!
const of = (p: Panel, purpose: Drill['purpose']) => p.drilling.filter((d) => d.purpose === purpose)

describe('конфирмат (§4.9)', () => {
  const side = byId('side-left')
  const top = byId('top')

  /**
   * `spreadAlongJoint` — таза функция: неше бұранда керегін ол шешпейді,
   * тек берілген санды буын бойына таратады. Үшінші бұранданың ЕРЕЖЕСІ
   * цехтың баптауында (`confirmatSpanForThird`) әрі 2026-09-02-ден бері
   * ӘДЕПКІДЕ ӨШІРУЛІ — qdesign 826 мм буында да екеуін қояды.
   */
  it('берілген сан буын бойына таралады, шеткілері жиектен 50 мм', () => {
    expect(spreadAlongJoint(447, 3, 50)).toEqual([50, 224, 397])
    expect(spreadAlongJoint(300, 2, 50)).toEqual([50, 250])
  })

  /**
   * ⚠ 2026-09-02-де бағыт ТҮЗЕТІЛДІ: бетте ҮЛКЕН өтпелі (Ø8), торцта КІШІ
   * пилот (Ø5×35). Бұранданың денесі бет арқылы өтіп, торцқа бұралады;
   * бұрынғы Ø5 өтпелі тесіктен Ø7 бұранда өте алмайтын. Сандар qdesign-ның
   * CNC экспортымен беттестірілген (constants.ts қара).
   */
  it('бүйірде Ø8 өтпелі, крышканың торцінде Ø5×35', () => {
    const faceHoles = of(side, 'confirmat')
    // Крышка + дно, әрқайсысына ЕКІ (үшінші бұранда ережесі әдепкіде өшірулі).
    expect(faceHoles).toHaveLength(4)
    for (const d of faceHoles) {
      expect(d.face).toBe('outer')
      expect(d.diameter).toBe(8)
      expect(d.depth).toBe(T) // өтпелі
    }
    const edgeHoles = of(top, 'confirmat')
    expect(edgeHoles).toHaveLength(4) // екі торц × 2
    for (const d of edgeHoles) {
      expect(d.diameter).toBe(5)
      expect(d.depth).toBe(35)
      expect(d.y).toBe(T / 2) // торцтың дәл ортасында
    }
    expect(new Set(edgeHoles.map((d) => d.face))).toEqual(new Set(['edgeW1', 'edgeW2']))
  })

  it('бүйірдегі тесік пен крышканың торціндегі тесік БІР сызықта', () => {
    // Екеуі де РЕЗ координатасында берілген: сәйкес келмесе бұранда қисаяды.
    const alongJoint = of(side, 'confirmat').filter((d) => d.x === T / 2).map((d) => d.y)
    const edge = of(byId('bottom'), 'confirmat').filter((d) => d.face === 'edgeW1').map((d) => d.x)
    expect(alongJoint.sort((a, b) => a - b)).toEqual(edge.sort((a, b) => a - b))
  })

  it('перегородка крышка мен дноға конфирматпен бекітіледі', () => {
    const p = generateCabinet(threeSectionWardrobe, catalog)
    const divider = p.find((x) => x.id === 'divider-1')!
    const faces = new Set(divider.drilling.filter((d) => d.purpose === 'confirmat').map((d) => d.face))
    expect(faces).toEqual(new Set(['edgeW1', 'edgeW2']))
  })
})

describe('полкодержатель — 32 мм жүйесі', () => {
  const side = byId('side-left')
  const pins = of(side, 'shelfPin')

  it('4 жылжымалы сөре × 5 тесік × 2 баған', () => {
    expect(pins).toHaveLength(40)
    for (const d of pins) {
      expect(d.face).toBe('inner')
      expect(d.diameter).toBe(5)
      expect(d.depth).toBe(8)
    }
  })

  it('екі баған: алдыңғы жиектен 37 мм, арт жиектен 37 мм', () => {
    // РЕЗ координатасы: алдыңғы жиекте 2 мм кромка бар → 37 − 2 = 35
    const shelfDepth = byId('s1-shelf-1').finishedWidth
    const columns = [...new Set(pins.map((d) => d.y))].sort((a, b) => a - b)
    expect(columns).toEqual([37 - 2, shelfDepth - 37 - 2])
  })

  it('барлық тесік 32 мм торында', () => {
    const datum = T + 32 // дноның үстіңгі беті + shelfPinDatum
    for (const d of pins) expect((d.x - datum) % 32).toBe(0)
  })

  it('әр сөренің номиналды биіктігіне ең жақын тесік жарты қадамнан алыс емес', () => {
    const column = pins.filter((d) => d.y === 35).map((d) => d.x)
    for (const shelf of panels.filter((p) => p.role === 'shelf')) {
      const nearest = Math.min(...column.map((x) => Math.abs(x - shelf.position.y)))
      expect(nearest, shelf.id).toBeLessThanOrEqual(16)
    }
  })

  it('фиксированная сөреде полкодержатель емес, конфирмат болады', () => {
    const fixed = generateCabinet(
      withCabinet({
        sections: [{
          id: 's1', widthMode: 'flex',
          contents: [{ kind: 'shelves', count: 2, shelfKind: 'fixed' }],
          fronts: null,
        }],
      }),
      catalog,
    )
    const s = fixed.find((p) => p.id === 's1-shelf-1')!
    expect(s.drilling.filter((d) => d.purpose === 'confirmat').length).toBeGreaterThan(0)
    expect(fixed.find((p) => p.id === 'side-left')!.drilling.filter((d) => d.purpose === 'shelfPin')).toHaveLength(0)
  })
})

describe('ілгек', () => {
  it('фасад биіктігіне қарай ілгек саны', () => {
    expect(hingeCount(700)).toBe(2)
    expect(hingeCount(1200)).toBe(3)
    expect(hingeCount(1994)).toBe(4)
    expect(hingeCount(2400)).toBe(5)
  })

  it('чашка Ø35×12.5, алдыңғы жиектен 22 мм', () => {
    const front = byId('s1-front-1')
    const cups = of(front, 'hinge')
    expect(cups).toHaveLength(4)
    for (const d of cups) {
      expect(d.diameter).toBe(35)
      expect(d.depth).toBe(12.5)
      expect(d.y).toBe(22 - 2) // РЕЗ координатасы, кромка 2 мм
    }
  })

  it('екі фасад қарама-қарсы жаққа ілінеді', () => {
    const left = of(byId('s1-front-1'), 'hinge')[0]!
    const right = of(byId('s1-front-2'), 'hinge')[0]!
    const w = byId('s1-front-2').finishedWidth
    expect(left.y).toBe(20)
    expect(right.y).toBe(w - 22 - 2)
  })

  it('бүйірде планка тесіктері 32 мм аралықта, алдыңғы жиектен 37 мм', () => {
    const plates = of(byId('side-left'), 'hinge')
    expect(plates).toHaveLength(8) // 4 ілгек × 2 тесік
    for (const d of plates) expect(d.y).toBe(37 - 2)
    const xs = plates.map((d) => d.x).sort((a, b) => a - b)
    expect(xs[1]! - xs[0]!).toBe(32)
  })
})

/**
 * ҚЫСҚА БУЫН — 09-04-те табылған ақау.
 *
 * `spreadAlongJoint(95, 2, 50)` бұрын `[50, 45]` беретін: екі тесік бір-бірінің
 * үстінде, әрі реті теріс. Ұзын буында ештеңе өзгермеуі керек — цехтың
 * қалыптасқан 50 мм шегінісі сол күйінде қалады.
 */
describe('қысқа буындағы конфирмат', () => {
  it('шегініс буынның үштен бірінен аспайды', () => {
    expect(spreadAlongJoint(95, 2, 50)).toEqual([32, 63])
    expect(spreadAlongJoint(120, 2, 50)).toEqual([40, 80])
  })

  it('ҰЗЫН буында ескі мінез өзгермеген', () => {
    expect(spreadAlongJoint(150, 2, 50)).toEqual([50, 100])
    expect(spreadAlongJoint(2000, 2, 50)).toEqual([50, 1950])
    expect(spreadAlongJoint(2000, 3, 50)).toEqual([50, 1000, 1950])
  })

  it('бір тесік әрқашан ортада', () => {
    expect(spreadAlongJoint(95, 1, 50)).toEqual([48])
  })
})
