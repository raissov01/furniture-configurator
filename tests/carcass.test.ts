/**
 * CLAUDE.md §8.2 — екі құрастыру әдісі де H, W, D-ға қайта жиналуы керек.
 * §8.3 — паздағы арт қабырға бүйір мен сөрені дұрыс қысқартады.
 */
import { describe, expect, it } from 'vitest'
import { boxesOverlap, generateCabinet, panelBox } from '../src/core/index.js'
import type { Panel } from '../src/core/index.js'
import { CARCASS_THICKNESS as T, catalog, referenceWardrobe, withCabinet } from './fixtures.js'

const byId = (panels: Panel[], id: string): Panel => {
  const p = panels.find((x) => x.id === id)
  if (!p) throw new Error(`панель жоқ: ${id}`)
  return p
}

const materialThickness = (p: Panel): number =>
  catalog.materials.find((m) => m.id === p.materialId)!.thickness

describe('корпус жиналымы', () => {
  it('sidesOverlay: бүйір + крышка/дно ені W-ға жиналады', () => {
    const p = generateCabinet(referenceWardrobe, catalog)
    const side = byId(p, 'side-left')
    const top = byId(p, 'top')
    expect(side.finishedLength).toBe(2000) // H
    expect(top.finishedLength + 2 * T).toBe(600) // W
    expect(side.finishedWidth + 3).toBe(450) // D = корпус + ХДФ
  })

  it('topBottomOverlay: крышка/дно толық енде, бүйір олардың арасында', () => {
    const p = generateCabinet(withCabinet({ construction: 'topBottomOverlay' }), catalog)
    const side = byId(p, 'side-left')
    const top = byId(p, 'top')
    expect(top.finishedLength).toBe(600) // W
    expect(side.finishedLength + 2 * T).toBe(2000) // H
  })

  it.each(['sidesOverlay', 'topBottomOverlay'] as const)(
    '%s: барлық панель кабинет габаритінің ішінде',
    (construction) => {
      const cfg = withCabinet({ construction })
      const panels = generateCabinet(cfg, catalog)
      for (const panel of panels) {
        const box = panelBox(panel, materialThickness(panel))
        expect(box.min.x).toBeGreaterThanOrEqual(0)
        expect(box.min.y).toBeGreaterThanOrEqual(0)
        expect(box.max.x).toBeLessThanOrEqual(cfg.width)
        expect(box.max.y).toBeLessThanOrEqual(cfg.height)
        // Накладной фасад корпустың алдында тұрады → z теріс болуы мүмкін.
        expect(box.max.z).toBeLessThanOrEqual(cfg.depth)
      }
    },
  )

  it.each(['sidesOverlay', 'topBottomOverlay'] as const)(
    '%s: панельдер бір-бірінің көлеміне кірмейді',
    (construction) => {
      const panels = generateCabinet(withCabinet({ construction }), catalog)
      const boxes = panels.map((p) => ({ id: p.id, box: panelBox(p, materialThickness(p)) }))
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!
          const b = boxes[j]!
          expect(boxesOverlap(a.box, b.box), `${a.id} ↔ ${b.id} қиылысады`).toBe(false)
        }
      }
    },
  )
})

describe('паздағы арт қабырға (§4.5)', () => {
  const groove = withCabinet({ back: { mode: 'groove' } })

  it('бүйір мен сөре grooveInset-ке қысқарады', () => {
    const overlayPanels = generateCabinet(referenceWardrobe, catalog)
    const groovePanels = generateCabinet(groove, catalog)

    expect(byId(overlayPanels, 'side-left').finishedWidth).toBe(447) // D − 3
    expect(byId(groovePanels, 'side-left').finishedWidth).toBe(440) // D − 10
    expect(byId(overlayPanels, 'shelf-1').finishedWidth).toBe(447)
    expect(byId(groovePanels, 'shelf-1').finishedWidth).toBe(440)
  })

  it('арт қабырға ішкі саңылау + екі жақтан пазға кіретін бөлік', () => {
    const back = byId(generateCabinet(groove, catalog), 'back')
    expect(back.finishedLength).toBe(2000 - 2 * T + 2 * 4) // H − 2t + 2·grooveDepth
    expect(back.finishedWidth).toBe(600 - 2 * T + 2 * 4)
  })

  it('пазда арт қабырғаға кромка жабыспайды', () => {
    const back = byId(generateCabinet(groove, catalog), 'back')
    expect(back.edges).toEqual({ L1: null, L2: null, W1: null, W2: null })
  })
})

describe('валидация', () => {
  it('тым таяз корпус — параметр аты мен аралығы бар қате', () => {
    expect(() => generateCabinet(withCabinet({ depth: 100 }), catalog)).toThrow(/cabinet.depth/)
  })

  it('бүтін емес өлшем қабылданбайды', () => {
    expect(() => generateCabinet(withCabinet({ width: 600.5 }), catalog)).toThrow(/бүтін сан емес/)
  })

  it('ХДФ қалыңдығы settings.backThickness-пен келіспесе — қате', () => {
    const badCatalog = {
      ...catalog,
      materials: catalog.materials.map((m) => (m.id === 'hdf3-white' ? { ...m, thickness: 4 } : m)),
    }
    expect(() => generateCabinet(referenceWardrobe, badCatalog)).toThrow(/backMaterialId/)
  })
})
