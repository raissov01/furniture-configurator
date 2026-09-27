import { describe, expect, it } from 'vitest'
import { classicToolStatus } from '../lib/classicStatus'

describe('classic status hint', () => {
  it('shows the hovered command first and restores the selection message on leave', () => {
    expect(classicToolStatus('Смета и раскрой', 'panel-1', 'Боковина', 'Выбран элемент', 'Элемент не выбран'))
      .toBe('Смета и раскрой')
    expect(classicToolStatus(null, 'panel-1', 'Боковина', 'Выбран элемент', 'Элемент не выбран'))
      .toBe('Выбран элемент: Боковина')
    expect(classicToolStatus(null, null, null, 'Выбран элемент', 'Элемент не выбран'))
      .toBe('Элемент не выбран')
  })
})
