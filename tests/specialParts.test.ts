import { describe, expect, it } from 'vitest'
import { bentDevelopment, bentDxf, specialPartRows, specialPartsPrice, validateLathe } from '../src/core/specialParts'
import type { FabricationSpec } from '../src/core/specialParts'

const bent: FabricationSpec = { kind: 'bent', chord: 100, radius: 100, height: 500,
  thickness: 10, referenceFace: 'inner', materialId: 'ply', quantity: 2, unitPrice: 12500 }

describe('special parts manufacturing', () => {
  it('rounds the developed inner arc to one whole millimetre and keeps the outer face separate', () => {
    if (bent.kind !== 'bent') throw new Error('fixture')
    expect(bentDevelopment(bent, 50)).toMatchObject({ radius: 100, innerRadius: 100,
      outerRadius: 110, developedLength: 105, height: 500 })
    expect(bentDevelopment({ ...bent, radius: undefined, angleDegrees: 60 }, 50).developedLength).toBe(105)
  })

  it('rejects impossible curvature and absent shop minimum radius', () => {
    if (bent.kind !== 'bent') throw new Error('fixture')
    expect(() => bentDevelopment(bent, undefined)).toThrow(/minBendRadiusMm/)
    expect(() => bentDevelopment(bent, 120)).toThrow(/radius/)
    expect(() => bentDevelopment({ ...bent, chord: 201 }, 50)).toThrow(/chord/)
    expect(() => bentDevelopment({ ...bent, radius: 100, angleDegrees: 60 }, 50)).toThrow(/radius/)
  })

  it('validates a turned profile and reports maximum diameter', () => {
    expect(validateLathe({ kind: 'lathe', profile: [{ radius: 20, y: 0 }, { radius: 35, y: 100 }],
      materialId: 'wood', quantity: 4, unitPrice: 3000 })).toEqual({ height: 100, maxDiameter: 70 })
    expect(() => validateLathe({ kind: 'lathe', profile: [{ radius: 20, y: 10 }, { radius: 30, y: 0 }],
      materialId: 'wood', quantity: 1, unitPrice: 0 })).toThrow(/profile/)
  })

  it('makes separate cut-list rows and prices, with no panel/nesting/drilling payload', () => {
    const rows = specialPartRows([{ nodeId: 'bend-1', name: 'Фасад', spec: bent }], new Map([['ply', { name: 'Фанера', minBendRadiusMm: 50 }]]))
    expect(rows).toEqual([{ nodeId: 'bend-1', section: 'Иілген деталь', name: 'Фасад',
      materialId: 'ply', materialName: 'Фанера', quantity: 2, height: 500,
      developedLength: 105, radius: 100, angleDegrees: 60,
      operation: 'жеке иілу операциясы', unitPrice: 12500 }])
    expect(specialPartsPrice(rows)).toEqual({ total: 25000, lines: [{ nodeId: 'bend-1', name: 'Фасад', quantity: 2, unitPrice: 12500, cost: 25000 }] })
    expect(() => specialPartsPrice([{ ...rows[0]!, unitPrice: 0.5 }])).toThrow(/unitPrice/)
    expect(rows[0]).not.toHaveProperty('cutWidth')
    expect(rows[0]).not.toHaveProperty('drilling')
  })

  it('exports only the developed rectangle as millimetre DXF', () => {
    const dxf = bentDxf(105, 500)
    expect(dxf).toContain('$INSUNITS\n70\n4')
    expect(dxf).toContain('LWPOLYLINE')
    expect(dxf).toContain('10\n105\n20\n500')
  })
})
