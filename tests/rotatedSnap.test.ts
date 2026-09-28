import { describe, expect, it } from 'vitest'
import { snapRotatedEdges, type SnapFootprint } from '../src/core/snap'
import { selectionBoxes } from '../src/core/treeArrange'
import { createDefaultLayer, SEED_CATALOG } from '../src/core/index'
import type { GroupNode } from '../src/core/tree'

function square(id: string, localX: number, localZ: number): SnapFootprint {
  const c = Math.SQRT1_2
  const project = (x: number, z: number) => ({ x: localX + x * c + z * c, z: localZ - x * c + z * c })
  return { id, minY: 0, maxY: 100, corners: [project(0, 0), project(100, 0), project(100, 100), project(0, 100)] }
}

describe('90°-тан тыс жиегіне snap', () => {
  it('45° екі жиегі арасындағы 5 мм саңылауды бүтін X/Z қозғалысымен жабады', () => {
    const target = square('target', 0, 0)
    const moving = square('moving', 105 * Math.SQRT1_2, -105 * Math.SQRT1_2)
    const result = snapRotatedEdges(moving, [target], 8)
    expect(result?.targetId).toBe('target')
    expect(result?.delta).toEqual({ x: -4, z: 4 })
  })

  it('вертикаль қабаттасу жоқ немесе қырлар алыс болса snap жасамайды', () => {
    const target = square('target', 0, 0)
    expect(snapRotatedEdges({ ...square('moving', 105 * Math.SQRT1_2, -105 * Math.SQRT1_2), minY: 120, maxY: 220 }, [target], 8)).toBeNull()
    expect(snapRotatedEdges(square('moving', 130 * Math.SQRT1_2, -130 * Math.SQRT1_2), [target], 8)).toBeNull()
  })

  it('туралау үшін 45° дененің бүтін сыртқы AABB-ын береді', () => {
    const root: GroupNode = { kind: 'group', id: 'root', name: 'root', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      children: [{ kind: 'solid', id: 's', name: 's', transform: { pos: { x: 10, y: 0, z: 10 }, rot: { x: 0, y: 45, z: 0 } },
        solid: { size: { x: 100, y: 100, z: 100 } } }] }
    const box = selectionBoxes(root, ['s'], SEED_CATALOG, [createDefaultLayer()])[0]!.bounds
    expect(box.min).toEqual({ x: 10, y: 0, z: -61 })
    expect(box.max).toEqual({ x: 152, y: 100, z: 81 })
  })
})
