import { describe, expect, it } from 'vitest'
import { menuPosition } from '@/lib/menuPosition'

describe('menuPosition', () => {
  it('keeps a long menu within a narrow viewport', () => {
    expect(menuPosition({ left: 310, right: 380, top: 800, bottom: 844 }, 390, 844, 240))
      .toEqual({ left: 138, top: 308, maxHeight: 480 })
  })

  it('uses the requested alignment when there is room', () => {
    expect(menuPosition({ left: 50, right: 120, top: 20, bottom: 60 }, 1000, 800, 180, 'left'))
      .toEqual({ left: 50, top: 60, maxHeight: 480 })


  })
})
