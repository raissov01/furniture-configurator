import { describe, expect, it } from 'vitest'
import { classicToolTip } from '../lib/f00kToolTip'

describe('сөндірулі құрал подсказкасы', () => {
  it('себебін атаумен бірге береді', () => {
    expect(classicToolTip('Присадка', true, 'Выберите корпус или доску'))
      .toBe('Присадка: Выберите корпус или доску')
  })
  it('қосулы құралда атау ғана қалады', () => {
    expect(classicToolTip('Присадка', false, 'Выберите корпус или доску')).toBe('Присадка')
  })
})
