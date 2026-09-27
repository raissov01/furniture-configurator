import { describe, expect, it } from 'vitest'
import { canConfirmDxfImport } from '@/lib/dxfImportAction'

describe('DXF импортын растау', () => {
  it('callback жоқ демода жалған импортты және қайталап басуды тоқтатады', () => {
    expect(canConfirmDxfImport(4, false, false)).toBe(false)
    expect(canConfirmDxfImport(4, true, true)).toBe(false)
    expect(canConfirmDxfImport(4, true, false)).toBe(true)
    expect(canConfirmDxfImport(0, true, false)).toBe(false)
  })
})
