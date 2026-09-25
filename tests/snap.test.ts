import { describe, expect, it } from 'vitest'
import { snapPosition } from '../src/core/snap'

const room = { width: 3000, height: 2500, depth: 2500 }
const moving = { pos: { x: 194, y: 71, z: 404 }, size: { x: 100, y: 100, z: 100 } }
const target = { id: 'a', pos: { x: 300, y: 70, z: 400 }, size: { x: 100, y: 100, z: 100 } }

describe('еркін нысан привязкасы', () => {
  it('бетке тірейді, өзге өстерді жеке жақын жиекке тартады', () => {
    const result = snapPosition(moving, [target], room, { grid: 0, tolerance: 10 })
    expect(result.pos).toEqual({ x: 200, y: 70, z: 400 })
    expect(result.hints).toEqual(expect.arrayContaining([
      expect.objectContaining({ axis: 'x', kind: 'face', at: 300, targetId: 'a' }),
      expect.objectContaining({ axis: 'y', kind: 'edge', at: 70, targetId: 'a' }),
    ]))
  })
  it('орталарды туралайды және төзімділіктен тыс нысанды қозғамайды', () => {
    const result = snapPosition({ pos: { x: 304, y: 500, z: 500 }, size: moving.size }, [target], room, { grid: 0, tolerance: 5 })
    expect(result.pos.x).toBe(300)
    expect(result.hints[0]?.kind).toBe('edge')
    expect(result.pos.y).toBe(500)
  })
  it('тор мен бөлме қабырғасын қолданады', () => {
    const result = snapPosition({ pos: { x: 12, y: 3, z: 2397 }, size: moving.size }, [], room, { grid: 10, tolerance: 15 })
    expect(result.pos).toEqual({ x: 10, y: 0, z: 2400 })
    expect(result.hints.map((hint) => hint.kind)).toContain('wall')
  })
  it('жарамсыз өлшем мен төзімділікті өрісімен қабылдамайды', () => {
    expect(() => snapPosition(moving, [], room, { grid: 0, tolerance: -1 })).toThrow(/tolerance/)
    expect(() => snapPosition({ ...moving, size: { ...moving.size, x: 1.5 } }, [], room, { grid: 10, tolerance: 5 })).toThrow(/moving.size.x/)
  })
})
