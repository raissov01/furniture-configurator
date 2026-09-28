import { describe, expect, it } from 'vitest'
import { nextCopyName } from '@/lib/copyName'

describe('copy names', () => {
  it('does not stack copy or mirror suffixes and numbers collisions', () => {
    expect(nextCopyName('Шкаф (зеркало) (копия)', ['Шкаф', 'Шкаф (копия)', 'Шкаф (копия 2)']))
      .toBe('Шкаф (копия 3)')
    expect(nextCopyName('Шкаф (копия 3)', [])).toBe('Шкаф (копия)')
  })
})
