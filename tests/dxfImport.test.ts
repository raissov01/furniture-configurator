/**
 * DXF импортының тесттері (2D жоспар: бөлме контурын оқу).
 *
 * Фикстуралар — `tests/fixtures/dxf-*.dxf`, қолмен жазылған кішкентай ASCII
 * DXF мәтіндері (интернеттен жүктелмеген). Тек осы тапсырманың өз файлы
 * (`src/core/import/dxf.ts`) тексеріледі, өзге агенттердің жарты күйіне
 * тәуелді емес.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ConfigValidationError } from '../src/core/errors'
import { importDxfRoomPlan } from '../src/core/import/dxf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8')

describe('DXF импорты — 2D жоспар', () => {
  it('4 LINE-нан тұратын тікбұрышты жоспар → 4 қабырға, ұзындықтары дұрыс', () => {
    const result = importDxfRoomPlan(fixture('dxf-rect-lines.dxf'))
    expect(result.walls).toHaveLength(4)
    expect(result.walls.map((w) => w.length).sort((a, b) => a - b)).toEqual([3000, 3000, 4000, 4000])
    expect(result.bounds).toEqual({ width: 4000, depth: 3000 })
    expect(result.layers).toEqual(['WALLS'])
    expect(result.skipped).toEqual([])
  })

  it('дәл сол жоспар LWPOLYLINE-мен берілсе — бірдей нәтиже', () => {
    const lines = importDxfRoomPlan(fixture('dxf-rect-lines.dxf'))
    const poly = importDxfRoomPlan(fixture('dxf-rect-lwpolyline.dxf'))
    expect(poly.walls).toHaveLength(4)
    expect(poly.walls.map((w) => w.length).sort((a, b) => a - b))
      .toEqual(lines.walls.map((w) => w.length).sort((a, b) => a - b))
    expect(poly.bounds).toEqual(lines.bounds)
  })

  it('$INSUNITS = см (5) болса — мм-ге қайта саналады, бүтін мм', () => {
    const result = importDxfRoomPlan(fixture('dxf-rect-cm.dxf'))
    expect(result.sourceUnits).toBe(5)
    expect(result.unitsConverted).toBe(true)
    expect(result.walls.map((w) => w.length).sort((a, b) => a - b)).toEqual([3000, 3000, 4000, 4000])
    expect(result.bounds).toEqual({ width: 4000, depth: 3000 })
    for (const w of result.walls) {
      expect(Number.isInteger(w.length)).toBe(true)
      expect(Number.isInteger(w.start.x)).toBe(true)
      expect(Number.isInteger(w.start.z)).toBe(true)
    }
  })

  it('бинарлы DXF → ConfigValidationError', () => {
    expect(() => importDxfRoomPlan(fixture('dxf-binary.dxf'))).toThrow(ConfigValidationError)
  })

  it('бұзылған/жарты файл → құламайды (silent catch емес), анық қате береді', () => {
    let caught: unknown = null
    try {
      importDxfRoomPlan(fixture('dxf-truncated.dxf'))
    } catch (err) {
      caught = err
    }
    expect(caught).not.toBeNull()
    expect(caught).toBeInstanceOf(ConfigValidationError)
    expect((caught as Error).message.length).toBeGreaterThan(0)
  })

  it('қолдауы жоқ нысан (SPLINE) — еленбейді, бірақ саны хабарланады', () => {
    const result = importDxfRoomPlan(fixture('dxf-with-spline.dxf'))
    expect(result.walls).toHaveLength(4)
    expect(result.skipped).toEqual([{ type: 'SPLINE', count: 1 }])
  })

  it('қабат бойынша сүзу: тек таңдалған layer қабырғаға кіреді', () => {
    const result = importDxfRoomPlan(fixture('dxf-rect-lines.dxf'), { layer: 'DECOR' })
    expect(result.walls).toHaveLength(0)
    // Бірақ қабат тізімі толық қалады — пайдаланушы таңдауы үшін.
    expect(result.layers).toEqual(['WALLS'])
  })
})
