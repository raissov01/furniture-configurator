import { describe, expect, it } from 'vitest'
import {
  catalogOf, cncIndexCsv, defaultShopProfile, edgeBandTotals, edgeMetresByBand,
  findTemplate, formatCutList, generateCabinet, panelToDxf, templateToCabinet,
} from '../src/core/index'
import { materialWidthRangeAt } from '../src/core/bevelBounds'
import type { CabinetConfig } from '../src/core/index'

const catalog = catalogOf(defaultShopProfile())
const template = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

const upperTransition = (): CabinetConfig => ({
  ...template,
  height: 720,
  depth: 600,
  back: { mode: 'none' },
  corner: { depthAtRight: 350 },
  sections: [{
    ...template.sections[0]!,
    fronts: null,
    contents: [{ kind: 'shelves', count: 1, shelfKind: 'adjustable' }],
  }],
})

describe('үстіңгі биіктіктегі өтпелі трапецияның өндірістік деректері', () => {
  it('оң жақтың confirmat/shelf-pin тесіктері мен торц тесіктері материалда жатады', () => {
    const panels = generateCabinet(upperTransition(), catalog)
    const right = panels.find((panel) => panel.id === 'side-right')!
    expect(right.drilling.some((hole) => hole.purpose === 'confirmat')).toBe(true)
    expect(right.drilling.some((hole) => hole.purpose === 'shelfPin')).toBe(true)
    expect([...new Set(right.drilling.filter((hole) => hole.purpose === 'confirmat').map((hole) => hole.y))])
      .toEqual([48, 298])
    expect([...new Set(right.drilling.filter((hole) => hole.purpose === 'shelfPin').map((hole) => hole.y))])
      .toEqual([35, 311])
    for (const hole of right.drilling) {
      if (hole.face !== 'inner' && hole.face !== 'outer') continue
      expect(hole.x, `${right.id} ${hole.purpose}`).toBeGreaterThanOrEqual(0)
      expect(hole.x, `${right.id} ${hole.purpose}`).toBeLessThanOrEqual(right.cutLength)
      expect(hole.y, `${right.id} ${hole.purpose}`).toBeGreaterThanOrEqual(0)
      expect(hole.y, `${right.id} ${hole.purpose}`).toBeLessThanOrEqual(right.cutWidth)
    }
    for (const panel of panels.filter((part) => part.bevel)) {
      for (const hole of panel.drilling) {
        const x = hole.face === 'edgeW1' ? 0 : hole.face === 'edgeW2' ? panel.cutLength : hole.x
        const [start, end] = materialWidthRangeAt(panel, x)
        if (hole.face === 'inner' || hole.face === 'outer') {
          expect(hole.y, `${panel.id} ${hole.purpose}`).toBeGreaterThanOrEqual(start)
          expect(hole.y, `${panel.id} ${hole.purpose}`).toBeLessThanOrEqual(end)
        } else if (hole.face === 'edgeW1' || hole.face === 'edgeW2') {
          expect(hole.x, `${panel.id} ${hole.purpose}`).toBeGreaterThanOrEqual(start)
          expect(hole.x, `${panel.id} ${hole.purpose}`).toBeLessThanOrEqual(end)
        }
      }
    }
  })

  it('DXF контуры, деталировка және CNC индексі қиғаш кесуді көрсетеді', () => {
    const panels = generateCabinet(upperTransition(), catalog)
    const top = panels.find((panel) => panel.id === 'top')!
    const [narrowStart] = materialWidthRangeAt(top, top.cutLength)
    const dxf = panelToDxf(top)
    expect(dxf).toContain(`10\n${top.cutLength}.0\n20\n${narrowStart}.0`)
    expect(formatCutList([top], catalog)[0]!.note).toContain('Трапеция: 600→350')
    expect(cncIndexCsv([top], catalog, { projectName: 'Бұрыштық' })).toContain('есть — см. DXF')
  })

  it('деталировка лентасының метрі сметадағы физикалық диагональмен бірдей', () => {
    const panels = generateCabinet(upperTransition(), catalog)
    const detail = edgeBandTotals(panels)
    const price = edgeMetresByBand(panels)
    expect(detail.get('pvc2-h1145')).toBe(price.get('pvc2-h1145'))
    const top = panels.find((panel) => panel.id === 'top')!
    const one = edgeMetresByBand([top]).get('pvc2-h1145')!
    expect(one).toBe(Math.round(Math.hypot(top.finishedLength, 250)) / 1000)
    expect(edgeBandTotals([{ ...top, qty: 2 }]).get('pvc2-h1145')).toBe(one * 2)
  })
})
