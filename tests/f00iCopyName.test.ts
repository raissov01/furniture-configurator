import { describe, expect, it } from 'vitest'
import { nextCopyName } from '@/src/core/copyName'

describe('nextCopyName', () => {
  it('numbers repeated copies without stacking suffixes', () => {
    expect(nextCopyName('Шкаф')).toBe('Шкаф (копия 1)')
    expect(nextCopyName('Шкаф (копия 1)')).toBe('Шкаф (копия 2)')
    expect(nextCopyName('Шкаф (копия) (копия)')).toBe('Шкаф (копия 3)')
  })

  it('finds the next unused sibling name independently of UI language', () => {
    expect(nextCopyName('Wardrobe', ['Wardrobe', 'Wardrobe (копия 1)', 'Wardrobe (копия 4)']))
      .toBe('Wardrobe (копия 5)')


  })
})
