import { describe, expect, it } from 'vitest'
import { nestingToDxfFiles } from '../src/core/export/dxf'
import type { NestingResult } from '../src/core/nesting'

const sheet = (materialId: string) => ({
  index: 1, materialId, sheetWidth: 2800, sheetHeight: 2070,
  usable: { x: 10, y: 10, width: 2780, height: 2050 },
  parts: [], offcuts: [],
})

describe('nesting DXF file names', () => {
  it('keeps every sheet when material IDs transliterate to the same basename', () => {
    const nesting: NestingResult = {
      byMaterial: ['a', 'а', 'A', 'normal'].map((materialId, index) => ({
        materialId, materialName: `Material ${index + 1}`,
        sheets: [sheet(materialId)], wastePercent: 100, partArea: 0, usableArea: 2780 * 2050,
      })),
      sheetCount: 4, unplaced: [],
    }
    const files = nestingToDxfFiles(nesting)
    expect(files.size).toBe(nesting.sheetCount)
    expect(new Set([...files.keys()].map((name) => name.toLowerCase())).size).toBe(nesting.sheetCount)
    expect(files.has('a-list-1.dxf')).toBe(true)
    expect(files.has('normal-list-1.dxf')).toBe(true)
    expect([...files.values()].some((dxf) => dxf.includes('Material 1'))).toBe(true)
    expect([...files.values()].some((dxf) => dxf.includes('Material 2'))).toBe(true)
    expect([...files.values()].some((dxf) => dxf.includes('Material 3'))).toBe(true)
    expect([...files.values()].some((dxf) => dxf.includes('Material 4'))).toBe(true)
  })
})
