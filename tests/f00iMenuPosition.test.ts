import { describe, expect, it } from 'vitest'
import { menuPosition } from '@/lib/menuPosition'

describe('mobile dropdown placement', () => {
  it('keeps a right-aligned menu inside a narrow viewport', () => {
    expect(menuPosition({ left: 335, right: 385, top: 120, bottom: 150 }, 390, 844, 260, 450, 'right'))
      .toEqual({ left: 122, top: 154, maxHeight: 682 })
  })

  it('opens upward when the trigger is near the bottom', () => {
    expect(menuPosition({ left: 10, right: 80, top: 770, bottom: 800 }, 390, 844, 200, 300, 'left'))
      .toEqual({ left: 10, top: 466, maxHeight: 758 })
  })
})
