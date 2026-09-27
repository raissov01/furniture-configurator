import { describe, expect, it } from 'vitest'
import { selectedStatusName } from '@/lib/classicStatus'

describe('selection status', () => {
  it('shows the selected panel instead of the containing cabinet', () => {
    expect(selectedStatusName('front-1', { id: 'cabinet-1', name: 'Шкаф' },
      { id: 'front-1', label: 'Фасад' }, (value) => value)).toBe('Фасад')
  })

  it('shows a selected tree node by its own name', () => {
    expect(selectedStatusName('solid-1', { id: 'solid-1', name: 'Декор' }, undefined, (value) => value)).toBe('Декор')
  })
})
