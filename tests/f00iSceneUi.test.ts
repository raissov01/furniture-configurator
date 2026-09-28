import { describe, expect, it } from 'vitest'
import { selectedStatusName, solidStartPosition } from '@/lib/sceneUiPlacement'

describe('scene status and placement', () => {
  it('names the selected panel and falls back to the selected node', () => {
    expect(selectedStatusName('p1', [{ id: 'p1', label: 'Фасад' }], 'Шкаф')).toBe('Фасад')
    expect(selectedStatusName('node1', [], 'Шкаф')).toBe('Шкаф')
  })
  it('places a new solid near the active node or in the visible room', () => {
    expect(solidStartPosition({ width: 4000, depth: 3000 }, { x: 500, y: 0, z: 200 }, 600)).toEqual({ x: 1200, y: 0, z: 200 })
    expect(solidStartPosition({ width: 4000, depth: 3000 }, null)).toEqual({ x: 2000, y: 0, z: 1500 })
  })
})
