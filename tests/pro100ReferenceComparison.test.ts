import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pro100TestKit } from '../src/core/export/pro100Kit'
import { generateCabinet } from '../src/core/generateCabinet'
import { edgeMetresByBand } from '../src/core/pricing'
import { catalogOf, defaultShopProfile } from '../src/core/shop'
import { findTemplate, templateToCabinet } from '../src/core/templates'

const fixture = new URL('./fixtures/pro100/reference/scenario1/', import.meta.url)

function rows(file: string): string[][] {
  return readFileSync(new URL(file, fixture), 'utf8')
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()).filter(Boolean))
}

describe('PRO100 сандық эталоны', () => {
  const scenarios = pro100TestKit(defaultShopProfile()).scenarios

  it('төрт сценарийдің әрқайсысын генератор қайта есептейді', () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      's1-base-600', 's2-wall-800', 's3-drawers-600', 's4-kitchen-2400',
    ])
    for (const scenario of scenarios) {
      const parts = scenario.expected.parts
      const areaByMaterial = new Map<string, number>()
      for (const part of parts) {
        expect(part.qty).toBeGreaterThan(0)
        expect(part.cutLength).toBeGreaterThan(0)
        expect(part.cutWidth).toBeGreaterThan(0)
        areaByMaterial.set(part.material, (areaByMaterial.get(part.material) ?? 0)
          + part.finishedLength * part.finishedWidth * part.qty)
      }
      expect(scenario.expected.materials.map((material) => [material.name, material.areaMm2]))
        .toEqual([...areaByMaterial])
      expect(scenario.expected.costs.goods + scenario.expected.costs.services)
        .toBe(scenario.expected.costs.total)
    }
  })

  it('құжаттағы біздің төрт сценарийдің саны мен дайын ауданын бекітеді', () => {
    expect(scenarios.map((scenario) => ({
      id: scenario.id,
      pieces: scenario.expected.parts.reduce((sum, part) => sum + part.qty, 0),
      positions: scenario.expected.parts.length,
      areas: scenario.expected.materials.slice().sort((a, b) => b.thickness - a.thickness)
        .map((material) => material.areaMm2),
      missingPrices: scenario.expected.costs.missingPrices.length,
    }))).toEqual([
      { id: 's1-base-600', pieces: 8, positions: 6, areas: [2_171_354, 432_000], missingPrices: 10 },
      { id: 's2-wall-800', pieces: 9, positions: 6, areas: [1_902_936, 576_000], missingPrices: 10 },
      { id: 's3-drawers-600', pieces: 23, positions: 9, areas: [3_686_266, 432_000], missingPrices: 9 },
      { id: 's4-kitchen-2400', pieces: 51, positions: 10, areas: [13_653_870, 3_456_000], missingPrices: 10 },
    ])
  })

  it('1-сценарийдегі PRO100 детальдары мен біздің конструкция айырмасын сақтайды', () => {
    const parts = rows('piece-list.txt')
    expect(parts).toEqual([
      ['боковина', '704', '541', '16', '2', '01 Основное для КУХНИ\\Лдсп'],
      ['дверь', '716', '297', '16', '2', '01 Основное для КУХНИ\\Лдсп'],
      ['задняя  стенка', '716', '596', '3', '1', '01 Основное для КУХНИ\\Двп 4мм'],
      ['крышка-дно', '600', '541', '16', '1', '01 Основное для КУХНИ\\Лдсп'],
      ['полка', '566', '541', '16', '1', '01 Основное для КУХНИ\\Лдсп'],
      ['цоколь', '568', '80', '16', '2', '01 Основное для КУХНИ\\Лдсп'],
    ])
    const actualArea = parts.filter((part) => part[5]?.endsWith('Лдсп'))
      .reduce((sum, part) => sum + Number(part[1]) * Number(part[2]) * Number(part[4]), 0)
    expect(actualArea).toBe(1_908_718)
    const ours = scenarios[0]!.expected
    expect(ours.parts.reduce((sum, part) => sum + part.qty, 0)).toBe(8)
    expect(ours.materials.find((material) => material.thickness === 16)?.areaMm2).toBe(2_171_354)
    expect(ours.parts.find((part) => part.role === 'side')).toMatchObject({
      qty: 2, finishedLength: 720, finishedWidth: 557, cutLength: 720, cutWidth: 555,
    })
    expect(ours.parts.find((part) => part.role === 'front')).toMatchObject({
      qty: 2, finishedLength: 714, finishedWidth: 295, cutLength: 710, cutWidth: 291,
      edgeAlongLength: 4, edgeAlongWidth: 4,
    })
  })

  it('1-сценарийдегі материал, фурнитура және бос смета есебін оқиды', () => {
    const consumption = rows('material-consumption.txt')
    expect(consumption).toEqual([
      ['01 Основное для КУХНИ\\Двп 4мм', '0.43', 'm²'],
      ['01 Основное для КУХНИ\\Лдсп', '1.91', 'm²'],
    ])
    const parts = rows('piece-list.txt')
    for (const material of consumption) {
      const areaMm2 = parts.filter((part) => part[5] === material[0])
        .reduce((sum, part) => sum + Number(part[1]) * Number(part[2]) * Number(part[4]), 0)
      expect(Math.round(areaMm2 / 10_000) / 100).toBe(Number(material[1]))
    }
    expect(rows('element-list.txt')).toEqual([['полкодержатель', '4']])
    const calculation = rows('calculation.txt')
    expect(calculation.filter((row) => ['materials', 'elements', 'assembly', 'others', 'TOTAL'].includes(row[0]!)))
      .toEqual(['materials', 'elements', 'assembly', 'others', 'TOTAL'].map((label) =>
        [label, '0', 'pc', '0.00', '0.00', '0.0', '0.00', '0.00']))
    expect(scenarios[0]!.expected.costs).toMatchObject({
      goods: 0, services: 0, total: 0,
    })
    expect(scenarios[0]!.expected.costs.missingPrices.length).toBeGreaterThan(0)
  })

  it('1-сценарийдің біздің кромка метражын панельдерден есептейді', () => {
    const shop = defaultShopProfile()
    const catalog = catalogOf(shop)
    const item = scenarios[0]!.items[0]!
    const template = findTemplate(item.ours.templateId)!
    const panels = generateCabinet(templateToCabinet(template, catalog, {
      height: item.height, width: item.width, depth: item.depth,
    }), catalog)
    const metresByThickness = new Map<number, number>()
    for (const [bandId, metres] of edgeMetresByBand(panels)) {
      const thickness = catalog.edgeBands.find((band) => band.id === bandId)!.thickness
      metresByThickness.set(thickness, (metresByThickness.get(thickness) ?? 0) + metres)
    }
    expect(metresByThickness.get(2)).toBeCloseTo(7.178, 6)
    expect(metresByThickness.get(0.4)).toBeCloseTo(2.228, 6)
  })
})
