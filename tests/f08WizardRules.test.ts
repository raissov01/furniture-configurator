import { describe, expect, it } from 'vitest'
import { selectWorktopMaterials, updateWizardLayout, validateWizardDraft, visibleWizardDraftErrors } from '@/lib/kitchenWizardDraft'
import type { Material } from '@/src/core/index'

const material = (id: string, slab: boolean) => ({ id, slab: slab ? { stockLengths: [3050], pricePerMeter: 0 } : undefined, name: id, thickness: 18, sheetWidth: 2800, sheetHeight: 2070, hasGrain: false, pricePerSheet: 0, trimEdge: 10 }) as Material
const valid = { layout: 'corner' as const, lengthA: 3200, lengthB: 2400, lengthC: 2000,
  lowerHeight: 720, lowerDepth: 500, plinthHeight: 95, worktopOverhang: 30,
  backsplashHeight: 600, upperElevation: 1460, upperHeight: 720, upperDepth: 320,
  worktopId: 'slab' }
const catalog = [material('hdf', false), material('slab', true)]

describe('F08 wizard rules', () => {
  it('offers only slab materials for the worktop', () => {
    expect(selectWorktopMaterials(catalog).map((m) => m.id)).toEqual(['slab'])
  })
  it('rejects invalid worktop and walls with parameter and range', () => {
    expect(validateWizardDraft({ ...valid, worktopId: 'hdf' }, catalog)?.field).toBe('materials.worktopId')
    expect(validateWizardDraft({ ...valid, lengthA: 0 }, catalog)?.message).toMatch(/lengthA.*600/)
    expect(validateWizardDraft({ ...valid, lengthA: 100000 }, catalog)?.message).toMatch(/lengthA.*20 000/)
    expect(validateWizardDraft({ ...valid, lengthB: 650.5 }, catalog)?.field).toBe('lengthB')
    expect(validateWizardDraft(valid, catalog)).toBeNull()
  })
  it('keeps visible draft errors while dropping hidden wall errors', () => {
    expect(visibleWizardDraftErrors({ lengthA: true, lengthB: true, 'runB.0': true }, 'straight')).toEqual({ lengthA: true })
  })
  it('drops hand edited modules whenever layout changes', () => {
    const modules = { runA: [{ kind: 'baseDoors', width: 600 }], runB: [{ kind: 'baseDoors', width: 600 }] }
    expect(updateWizardLayout({ layout: 'corner', modules }, 'straight').modules).toBeNull()
    expect(updateWizardLayout({ layout: 'corner', modules }, 'corner').modules).toBe(modules)
  })
})
