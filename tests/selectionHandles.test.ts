import { describe, expect, it } from 'vitest'
import { selectionHandlePositions } from '../lib/selectionHandles'

describe('таңдаудың сегіз бұрыш тұтқасы', () => {
  it('қораптың дәл сегіз төбесін береді', () => {
    const handles = selectionHandlePositions({ x: 600, y: 2000, z: 450 }, false)
    expect(handles).toHaveLength(8)
    expect(new Set(handles.map((point) => point.join(','))).size).toBe(8)
    expect(handles).toContainEqual([-300, -1000, -225])
    expect(handles).toContainEqual([300, 1000, 225])
  })
})
