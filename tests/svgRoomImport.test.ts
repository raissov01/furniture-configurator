/**
 * SVG-ден бөлме силуэтін импорттау (03g §5). Фикстуралар — `tests/fixtures/svg-room-*.svg`,
 * қолмен жазылған шағын файлдар. Нәтиже DXF импортымен бір пішінде (`DxfImportResult`).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ConfigValidationError } from '../src/core/errors'
import type { DxfImportResult } from '../src/core/import/dxf'
import { importSvgRoomPlan } from '../src/core/import/svgRoom'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf-8')

function fieldOf(run: () => unknown): string {
  try { run() } catch (cause) {
    if (cause instanceof ConfigValidationError) return cause.field
    throw cause
  }
  throw new Error('қате лақтырылмады')
}

describe('SVG бөлме импорты', () => {
  it('мм + viewBox: L-пішінді бөлме → 6 қабырға, бүтін мм, ең үлкен контур таңдалады', () => {
    const result = importSvgRoomPlan(fixture('svg-room-l-shape-mm.svg'))
    expect(result.scaleSource).toBe('viewBox')
    expect(result.mmPerUnit).toBe(10)
    expect(result.sourceUnits).toBe(4)
    expect(result.outline).toEqual([
      { x: 0, z: 0 }, { x: 5000, z: 0 }, { x: 5000, z: 2500 },
      { x: 3000, z: 2500 }, { x: 3000, z: 4000 }, { x: 0, z: 4000 },
    ])
    expect(result.walls.map((w) => w.length)).toEqual([5000, 2500, 2000, 1500, 3000, 4000])
    expect(result.walls.every((w) => w.layer === 'room')).toBe(true)
    expect(result.bounds).toEqual({ width: 5000, depth: 4000 })
    expect(result.areaMm2).toBe(5000 * 2500 + 3000 * 1500)
    // clipPath ішіндегі 9000 бірлік rect ескерілмейді; диван — екінші контур.
    expect(result.shapes.map((s) => s.label)).toEqual(['#room', '#sofa'])
    expect(result.skipped).toEqual([{ type: 'circle', count: 1 }, { type: 'path:curve', count: 1 }])
  })

  it('DXF нәтижесінің пішінін толық қайталайды', () => {
    const result: DxfImportResult = importSvgRoomPlan(fixture('svg-room-l-shape-mm.svg'))
    expect(Object.keys(result)).toEqual(expect.arrayContaining(
      ['walls', 'circles', 'arcs', 'layers', 'bounds', 'skipped', 'sourceUnits', 'unitsConverted']))
    for (const wall of result.walls) {
      expect(Number.isInteger(wall.start.x) && Number.isInteger(wall.end.z) && Number.isInteger(wall.length)).toBe(true)
    }
  })

  it('elementId — нақты элементті таңдайды, табылмаса өріс атымен қате', () => {
    const sofa = importSvgRoomPlan(fixture('svg-room-l-shape-mm.svg'), { elementId: 'sofa' })
    expect(sofa.bounds).toEqual({ width: 2000, depth: 900 })
    expect(sofa.outline[0]).toEqual({ x: 200, z: 200 })
    expect(fieldOf(() => importSvgRoomPlan(fixture('svg-room-l-shape-mm.svg'), { elementId: 'nope' }))).toBe('elementId')
  })

  it('бірліксіз SVG — масштабсыз ҚАТЕ, mmPerUnit берілсе оқылады', () => {
    expect(fieldOf(() => importSvgRoomPlan(fixture('svg-room-unitless.svg')))).toBe('mmPerUnit')
    const result = importSvgRoomPlan(fixture('svg-room-unitless.svg'), { mmPerUnit: 10 })
    expect(result.scaleSource).toBe('parameter')
    expect(result.bounds).toEqual({ width: 4000, depth: 3000 })
    expect(result.walls).toHaveLength(4)
    expect(fieldOf(() => importSvgRoomPlan(fixture('svg-room-unitless.svg'), { mmPerUnit: 0 }))).toBe('mmPerUnit')
  })

  it('см + кірістірілген transform (translate → scale) дұрыс қолданылады', () => {
    const result = importSvgRoomPlan(fixture('svg-room-transform-cm.svg'))
    // 1000 см ÷ 1000 бірлік = 10 мм; rect 200 × 150 ×2 → 4000 × 3000 мм, ығысу (10, 20) → (100, 200) мм.
    expect(result.mmPerUnit).toBe(10)
    expect(result.sourceUnits).toBe(5)
    expect(result.outline).toEqual([
      { x: 100, z: 200 }, { x: 4100, z: 200 }, { x: 4100, z: 3200 }, { x: 100, z: 3200 },
    ])
  })

  it('бір атрибуттағы transform тізімі солдан оңға құрастырылады', () => {
    const svg = '<svg width="1000mm" height="1000mm" viewBox="0 0 100 100">'
      + '<rect transform="translate(10,20) scale(2)" width="30" height="10"/></svg>'
    // translate·scale: (0,0) → (10,20); scale·translate болса (20,40) шығар еді.
    expect(importSvgRoomPlan(svg).outline[0]).toEqual({ x: 100, z: 200 })
    expect(importSvgRoomPlan(svg).bounds).toEqual({ width: 600, depth: 200 })
  })

  it('физикалық width бар, viewBox жоқ — бір бірлік = CSS пиксель (1/96 дюйм)', () => {
    const svg = '<svg width="400mm" height="400mm"><polygon points="0,0 960,0 960,480 0,480"/></svg>'
    const result = importSvgRoomPlan(svg)
    expect(result.scaleSource).toBe('cssPixel')
    expect(result.bounds).toEqual({ width: 254, depth: 127 })
  })

  it('өзін қиятын контур — өріс атымен қате', () => {
    expect(fieldOf(() => importSvgRoomPlan(fixture('svg-room-bowtie.svg')))).toBe('svg.#bow')
  })

  it('тек қисық пен ашық сызық — «жабық контур жоқ» қатесі', () => {
    expect(fieldOf(() => importSvgRoomPlan(fixture('svg-room-curves-only.svg')))).toBe('svg.content')
  })

  it('масштабы біркелкі емес viewBox пен бұзық жол — өріс атымен қате', () => {
    const skewed = '<svg width="4000mm" height="1000mm" viewBox="0 0 400 400"><rect width="10" height="10"/></svg>'
    expect(fieldOf(() => importSvgRoomPlan(skewed))).toBe('svg.viewBox')
    const broken = '<svg width="400mm" height="400mm" viewBox="0 0 400 400"><path id="p" d="M 0 0 L 10"/></svg>'
    expect(fieldOf(() => importSvgRoomPlan(broken))).toBe('svg.path#p.d')
    expect(fieldOf(() => importSvgRoomPlan('<html></html>'))).toBe('svg.content')
  })

  it('салыстырмалы командалар мен бір түзудегі артық төбе тазаланады', () => {
    const svg = '<svg width="300mm" height="200mm" viewBox="0 0 300 200"><path d="m0 0 h150 h150 v200 l-300 0 z"/></svg>'
    const result = importSvgRoomPlan(svg)
    expect(result.outline).toEqual([{ x: 0, z: 0 }, { x: 300, z: 0 }, { x: 300, z: 200 }, { x: 0, z: 200 }])
  })
})
