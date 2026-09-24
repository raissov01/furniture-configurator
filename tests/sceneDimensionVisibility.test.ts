import { describe, expect, it } from 'vitest'
import { shouldRenderDimensions } from '../lib/sceneDimensionVisibility'

describe('3D dimension labels', () => {
  it('obeys the editor toggle for its active cabinet', () => {
    expect(shouldRenderDimensions(true, true, true)).toBe(true)
    expect(shouldRenderDimensions(false, true, true)).toBe(false)
    expect(shouldRenderDimensions(true, false, true)).toBe(false)
  })

  it('never reveals labels in the client viewer even when editor state enables them', () => {
    expect(shouldRenderDimensions(true, true, false)).toBe(false)
  })
})
