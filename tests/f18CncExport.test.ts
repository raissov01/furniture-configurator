import { describe, expect, it } from 'vitest'
import { panelCncCsv, panelCncAvailable } from '@/lib/panelCncExport'
import type { Panel } from '@/src/core/index'

const panel = (id: string, drilling: Panel['drilling']): Panel => ({
  id, label: 'Боковина', cutLength: 2000, cutWidth: 445, drilling,
} as Panel)

describe('F18 жеке панель CNC CSV', () => {
  it('екі бірдей атаулы панельге бөлек файл мен ID/рез береді', () => {
    const drill = [{ face: 'inner', x: 37, y: 32, diameter: 5, depth: 8, purpose: 'shelfPin' }] as Panel['drilling']
    const left = panelCncCsv(panel('side-left', drill), () => false)
    const right = panelCncCsv(panel('side-right', drill), () => false)
    expect(left.name).not.toBe(right.name)
    expect(left.name).toContain('side-left')
    expect(left.csv).toContain('ID;Рез длина;Рез ширина')
    expect(left.csv).toContain('side-left;2000;445')
  })

  it('тесігі жоқ панельдің экспорты жабылады', () => {
    const empty = panel('shelf-1', [])
    expect(panelCncAvailable(empty)).toBe(false)
    expect(() => panelCncCsv(empty, () => false)).toThrow(/тесік/i)
  })
})
