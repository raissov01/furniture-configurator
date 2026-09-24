import { describe, expect, it } from 'vitest'
import { cabinetToDxfFiles, catalogOf, generateCabinet, panelToDxf } from '../src/core/index'
import { defaultCabinet, defaultShop } from '../lib/defaults'

describe('detail DXF filenames', () => {
  it('keeps distinct files when panel IDs differ only by case and skips an existing suffix', () => {
    const source = generateCabinet(defaultCabinet, catalogOf(defaultShop))[0]!
    const panels = ['A', 'a', 'a--2'].map((id) => ({ ...source, id, label: `Panel ${id}` }))
    const files = cabinetToDxfFiles(panels)

    expect([...files.keys()]).toEqual(['A.dxf', 'a--3.dxf', 'a--2.dxf'])
    expect(files.size).toBe(panels.length)
    expect([...files.keys()].map((name) => name.toLowerCase()).length)
      .toBe(new Set([...files.keys()].map((name) => name.toLowerCase())).size)
    expect(files.get('a--3.dxf')).toBe(panelToDxf(panels[1]!))
    expect(files.get('a--2.dxf')).toBe(panelToDxf(panels[2]!))
  })
})
