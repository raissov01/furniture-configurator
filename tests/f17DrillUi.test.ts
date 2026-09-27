import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import { drillClickResult, drillDeleteDecision, drillPresetOptions } from '../lib/f17DrillUi'

const panels = generateCabinet(templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG), SEED_CATALOG)
const front = panels.find((panel) => panel.role === 'front')!

describe('F17 drill editor decisions', () => {
  it('rejects a hinge cup overlapping the cut edge with a parameter and range', () => {
    const result = drillClickResult(front, 16, 'hinge-cup', {}, { face: 'inner', x: 0, y: 160 })
    expect(result).toMatchObject({ error: expect.stringContaining('position') })
    expect(result.error).toContain('17.5')
  })

  it('explains a face and edge preset mismatch', () => {
    expect(drillClickResult(front, 16, 'confirmat-edge', {}, { face: 'inner', x: 50, y: 50 }).error)
      .toContain('торц')
  })

  it('uses the active shop diameter and depth in names and holes', () => {
    const settings = { confirmatFaceDiameter: 9, confirmatEdgeDepth: 40 }
    expect(drillPresetOptions(settings)[0]?.name).toContain('Ø9')
    expect(drillPresetOptions(settings)[1]?.name).toContain('40')
    expect(drillClickResult(front, 16, 'confirmat-face', settings,
      { face: 'inner', x: 50, y: 50 }).drill?.diameter).toBe(9)
  })

  it('prohibits deleting generated free board holes and permits manual ones', () => {
    expect(drillDeleteDecision(true, false)).toBe('auto-board')
    expect(drillDeleteDecision(true, true)).toBe('delete')
    expect(drillDeleteDecision(false, false)).toBe('delete')
  })
})
