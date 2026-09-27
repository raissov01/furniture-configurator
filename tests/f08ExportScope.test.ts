import { describe, expect, it } from 'vitest'
import { selectShopExportPanels } from '@/lib/shopExportScope'
import type { Panel } from '@/src/core/index'

describe('F08 shop export scope', () => {
  const first = [{ id: 'a' }] as Panel[]
  const all = [{ id: 'a' }, { id: 'b' }] as Panel[]
  it('takes all project panels for project CSV/XLSX/DXF and active panels for cabinet', () => {
    expect(selectShopExportPanels('project', 'csv', first, all)).toBe(all)
    expect(selectShopExportPanels('cabinet', 'dxf', first, all)).toBe(first)
  })
  it('does not offer a project PDF assembly drawing', () => {
    expect(() => selectShopExportPanels('project', 'pdf', first, all)).toThrow(/PDF/)
  })
})
