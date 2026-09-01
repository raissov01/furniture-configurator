/**
 * Рез жоспары. Мұндағы тестердің басты мақсаты — САНДЫ емес, ЕРЕЖЕНІ ұстау:
 * бірде-бір рез детальді қақ жармауы керек, ал сандар (рез саны, ұзындығы,
 * бұрылыс, КИМ) парақтардың қосындысымен сәйкес келуі тиіс.
 *
 * Екі нақты фикстура да бар: қолмен саналатын кішкене парақ. Ол алгоритм
 * ауысқанда «жақсарды ма, бұзылды ма» дегенді көзбен көрсетеді.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  cutPlan,
  findTemplate,
  generateCabinet,
  nestPanels,
  offcutSummary,
  sheetCutPlan,
  templateToCabinet,
} from '../src/core/index'
import type { CutLine, NestedPart, NestedSheet, Panel } from '../src/core/index'

const panelsOf = (id: string): Panel[] =>
  generateCabinet(templateToCabinet(findTemplate(id)!, SEED_CATALOG), SEED_CATALOG)

const projectPanels = (): Panel[] => [
  ...panelsOf('wardrobe-3sec-1800'),
  ...panelsOf('kitchen-base-600'),
  ...panelsOf('bookcase-2sec-1200'),
]

const part = (panelId: string, x: number, y: number, width: number, height: number): NestedPart =>
  ({ panelId, label: panelId, x, y, width, height, rotated: false })

/** Рез детальді қақ жара ма: сызық детальдің ІШІНЕН өтіп, оны қиып тұр ма. */
function splitsPart(cut: CutLine, p: NestedPart): boolean {
  if (cut.axis === 'v') {
    const crosses = p.x < cut.at && cut.at < p.x + p.width
    const overlaps = cut.from < p.y + p.height && p.y < cut.to
    return crosses && overlaps
  }
  const crosses = p.y < cut.at && cut.at < p.y + p.height
  const overlaps = cut.from < p.x + p.width && p.x < cut.to
  return crosses && overlaps
}

describe('рез жоспары — қасиеттер', () => {
  const nesting = nestPanels(projectPanels(), SEED_CATALOG)
  const plan = cutPlan(nesting)

  it('бірде-бір рез детальді ҚАҚ ЖАРМАЙДЫ', () => {
    for (const m of plan.byMaterial) {
      const material = nesting.byMaterial.find((x) => x.materialId === m.materialId)!
      for (const sheet of m.sheets) {
        const parts = material.sheets.find((s) => s.index === sheet.index)!.parts
        for (const cut of sheet.cuts) {
          for (const p of parts) {
            expect(
              splitsPart(cut, p),
              `${m.materialName} лист ${sheet.index}: рез #${cut.order} ${cut.axis}@${cut.at} → ${p.label}`,
            ).toBe(false)
          }
        }
      }
    }
  })

  it('n детальді бөлу үшін кемінде n−1 рез керек', () => {
    for (const m of plan.byMaterial) {
      const material = nesting.byMaterial.find((x) => x.materialId === m.materialId)!
      for (const sheet of m.sheets) {
        const parts = material.sheets.find((s) => s.index === sheet.index)!.parts
        expect(sheet.stats.cutCount).toBeGreaterThanOrEqual(parts.length - 1)
      }
    }
  })

  it('рет нөмірлері 1-ден үзіліссіз', () => {
    for (const m of plan.byMaterial) {
      for (const sheet of m.sheets) {
        expect(sheet.cuts.map((c) => c.order)).toEqual(sheet.cuts.map((_, i) => i + 1))
      }
    }
  })

  it('бұрылыс саны рез санынан аспайды', () => {
    for (const m of plan.byMaterial) {
      for (const sheet of m.sheets) {
        expect(sheet.stats.turns).toBeGreaterThanOrEqual(0)
        expect(sheet.stats.turns).toBeLessThanOrEqual(Math.max(0, sheet.stats.cutCount - 1))
      }
    }
  })

  it('КИМ 0 мен 100 аралығында әрі ауданнан шығады', () => {
    for (const m of plan.byMaterial) {
      for (const sheet of m.sheets) {
        const { partArea, sheetArea, kim } = sheet.stats
        expect(kim).toBeGreaterThan(0)
        expect(kim).toBeLessThanOrEqual(100)
        expect(kim).toBeCloseTo((partArea / sheetArea) * 100, 9)
      }
    }
  })

  it('материалдың саны — парақтардың ҚОСЫНДЫСЫ', () => {
    for (const m of plan.byMaterial) {
      const sum = (pick: (s: (typeof m.sheets)[number]) => number) =>
        m.sheets.reduce((acc, s) => acc + pick(s), 0)
      expect(m.stats.cutCount).toBe(sum((s) => s.stats.cutCount))
      expect(m.stats.cutLength).toBe(sum((s) => s.stats.cutLength))
      expect(m.stats.turns).toBe(sum((s) => s.stats.turns))
      expect(m.stats.partArea).toBe(sum((s) => s.stats.partArea))
      expect(m.stats.sheetArea).toBe(sum((s) => s.stats.sheetArea))
    }
  })

  it('жалпы сан — материалдардың қосындысы', () => {
    const sum = (pick: (m: (typeof plan.byMaterial)[number]) => number) =>
      plan.byMaterial.reduce((acc, m) => acc + pick(m), 0)
    expect(plan.stats.cutCount).toBe(sum((m) => m.stats.cutCount))
    expect(plan.stats.cutLength).toBe(sum((m) => m.stats.cutLength))
    expect(plan.stats.sheetArea).toBe(sum((m) => m.stats.sheetArea))
    expect(plan.stats.kim).toBeCloseTo((plan.stats.partArea / plan.stats.sheetArea) * 100, 9)
  })

  it('нәтиже ТҰРАҚТЫ: екі шақыру бірдей жоспар береді', () => {
    expect(cutPlan(nesting)).toEqual(plan)
  })

  it('әр рез сол парақтың сыртына шықпайды', () => {
    for (const m of plan.byMaterial) {
      const material = nesting.byMaterial.find((x) => x.materialId === m.materialId)!
      for (const sheet of m.sheets) {
        const nested = material.sheets.find((s) => s.index === sheet.index)!
        for (const cut of sheet.cuts) {
          const limit = cut.axis === 'v' ? nested.sheetWidth : nested.sheetHeight
          const span = cut.axis === 'v' ? nested.sheetHeight : nested.sheetWidth
          expect(cut.at).toBeGreaterThanOrEqual(0)
          expect(cut.at).toBeLessThanOrEqual(limit)
          expect(cut.from).toBeGreaterThanOrEqual(0)
          expect(cut.to).toBeLessThanOrEqual(span)
          expect(cut.to).toBeGreaterThan(cut.from)
        }
      }
    }
  })
})

describe('рез жоспары — қолмен саналатын парақ', () => {
  it('екі деталь парақты толық жапса, бір ғана рез болады', () => {
    const sheet: NestedSheet = {
      index: 1,
      materialId: 'm',
      sheetWidth: 1000,
      sheetHeight: 1000,
      usable: { x: 0, y: 0, width: 1000, height: 1000 },
      parts: [part('A', 0, 0, 400, 1000), part('B', 404, 0, 596, 1000)],
      offcuts: [],
    }
    const plan = sheetCutPlan(sheet, { kerf: 4 })

    expect(plan.cuts).toHaveLength(1)
    expect(plan.cuts[0]).toMatchObject({ axis: 'v', at: 400, from: 0, to: 1000, kind: 'split', order: 1 })
    expect(plan.stats.cutLength).toBe(1000)
    expect(plan.stats.turns).toBe(0)
    expect(plan.stats.kim).toBeCloseTo(99.6, 9)
  })

  it('подрезка мен жалғыз деталь: 4 обрезка + 2 өлшемге келтіру', () => {
    const sheet: NestedSheet = {
      index: 1,
      materialId: 'm',
      sheetWidth: 1000,
      sheetHeight: 1000,
      usable: { x: 10, y: 10, width: 980, height: 980 },
      parts: [part('A', 10, 10, 500, 500)],
      offcuts: [],
    }
    const plan = sheetCutPlan(sheet, { kerf: 4 })

    expect(plan.cuts.filter((c) => c.kind === 'trim')).toHaveLength(4)
    expect(plan.cuts.filter((c) => c.kind === 'size')).toHaveLength(2)
    // Обрезка: екі тік (1000) + екі көлденең (1000); өлшемге келтіру: екеуі 980.
    expect(plan.stats.cutLength).toBe(4 * 1000 + 2 * 980)
    // v,v,h,h → сосын h,v: бағыт екі рет ауысады.
    expect(plan.stats.turns).toBe(2)
    expect(plan.stats.kim).toBeCloseTo(25, 9)
  })

  it('деталь парақты толық жапса, өлшемге келтіру резі ЖОҚ', () => {
    const sheet: NestedSheet = {
      index: 1,
      materialId: 'm',
      sheetWidth: 600,
      sheetHeight: 400,
      usable: { x: 0, y: 0, width: 600, height: 400 },
      parts: [part('A', 0, 0, 600, 400)],
      offcuts: [],
    }
    expect(sheetCutPlan(sheet).cuts).toEqual([])
    expect(sheetCutPlan(sheet).stats.kim).toBe(100)
  })
})

describe('қалдықтар', () => {
  it('деталь + деловой отход + қоқыс = парақ', () => {
    const nesting = nestPanels(projectPanels(), SEED_CATALOG)
    for (const m of nesting.byMaterial) {
      for (const sheet of m.sheets) {
        const summary = offcutSummary(sheet)
        const partArea = sheet.parts.reduce((sum, p) => sum + p.width * p.height, 0)
        expect(partArea + summary.usefulArea + summary.scrapArea)
          .toBeCloseTo(sheet.sheetWidth * sheet.sheetHeight, 6)
      }
    }
  })
})
