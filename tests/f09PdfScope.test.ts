import { describe, expect, it } from 'vitest'
import { splitProjectPdfPanels } from '@/lib/projectPdfScope'
import type { Panel } from '@/src/core/index'

describe('F09 project PDF scope', () => {
  it('keeps only the selected cabinet in projections and includes other panels in the cut list', () => {
    const cabinet = [{ id: 'side' }, { id: 'top' }] as Panel[]
    const project = [{ id: 'cab-1--side' }, { id: 'cab-1--top' }, { id: 'board-2--free' }] as Panel[]
    expect(splitProjectPdfPanels('cab-1', cabinet, project, 2)).toEqual({
      assembly: cabinet, supplementary: [project[2]],
    })
  })
})
