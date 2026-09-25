import { describe, expect, it } from 'vitest'
import {
  catalogOf, cncIndexCsv, defaultShopProfile, edgeBandTotals, edgeMetresByBand,
  findTemplate, formatCutList, generateCabinet, panelToDxf, templateToCabinet,
  nestPanels, priceProject,
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
      const radius = hole.diameter / 2
      expect(hole.x - radius, `${right.id} ${hole.purpose}`).toBeGreaterThanOrEqual(0)
      expect(hole.x + radius, `${right.id} ${hole.purpose}`).toBeLessThanOrEqual(right.cutLength)
      expect(hole.y - radius, `${right.id} ${hole.purpose}`).toBeGreaterThanOrEqual(0)
      expect(hole.y + radius, `${right.id} ${hole.purpose}`).toBeLessThanOrEqual(right.cutWidth)
    }
    for (const panel of panels.filter((part) => part.bevel)) {
      for (const hole of panel.drilling) {
        const x = hole.face === 'edgeW1' ? 0 : hole.face === 'edgeW2' ? panel.cutLength : hole.x
        const [start, end] = materialWidthRangeAt(panel, x)
        const radius = hole.diameter / 2
        if (hole.face === 'inner' || hole.face === 'outer') {
          const [startBefore, endBefore] = materialWidthRangeAt(panel, x - radius)
          const [startAfter, endAfter] = materialWidthRangeAt(panel, x + radius)
          expect(hole.x - radius).toBeGreaterThanOrEqual(0)
          expect(hole.x + radius).toBeLessThanOrEqual(panel.cutLength)
          expect(hole.y - radius, `${panel.id} ${hole.purpose}`)
            .toBeGreaterThanOrEqual(Math.max(startBefore, startAfter))
          expect(hole.y + radius, `${panel.id} ${hole.purpose}`)
            .toBeLessThanOrEqual(Math.min(endBefore, endAfter))
        } else if (hole.face === 'edgeW1' || hole.face === 'edgeW2') {
          expect(hole.x - radius, `${panel.id} ${hole.purpose}`).toBeGreaterThanOrEqual(start)
          expect(hole.x + radius, `${panel.id} ${hole.purpose}`).toBeLessThanOrEqual(end)
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
    const shelf = panels.find((panel) => panel.role === 'shelf')!
    expect(shelf.note).not.toBe('')
    expect(formatCutList([shelf], catalog)[0]!.note).toContain('Трапеция:')
  })

  it('бірдей заготовка, бірақ бөлек қиғаш контур екі деталировка позициясы', () => {
    const top = generateCabinet(upperTransition(), catalog).find((panel) => panel.id === 'top')!
    const second = { ...top, id: 'other', bevel: { ...top.bevel!, widthAtEnd: 400 } }
    expect(formatCutList([top, second], catalog)).toHaveLength(2)
    const mirrored = { ...top, id: 'mirrored', bevel: { ...top.bevel!, alignWidth: 'start' as const } }
    const mirroredRows = formatCutList([top, mirrored], catalog)
    expect(mirroredRows).toHaveLength(2)
    expect(mirroredRows.map((row) => row.note)).toEqual([
      expect.stringContaining('прямая сторона L2'), expect.stringContaining('прямая сторона L1'),
    ])
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
    const double = { ...top, qty: 2 }
    const quote = priceProject([double], nestPanels([double], catalog), defaultShopProfile())
    const row = quote.byMaterial.find((item) => item.materialId === top.materialId)!
    expect(row.edgeMetres).toBe(Math.round(one * 2 * 100) / 100)
  })
})
