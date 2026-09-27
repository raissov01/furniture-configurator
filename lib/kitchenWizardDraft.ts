import type { Material } from '@/src/core/index'
import { KITCHEN_WALL_UI_MAX } from '@/lib/kitchenWallInput'

export type WizardLayout = 'straight' | 'corner' | 'u'
export type WizardDimensions = {
  layout: WizardLayout
  lengthA: number; lengthB: number; lengthC: number
  lowerHeight: number; lowerDepth: number; plinthHeight: number
  worktopOverhang: number; backsplashHeight: number
  upperElevation: number; upperHeight: number; upperDepth: number
  worktopId: string
}

const dimensionMinimums = {
  lowerHeight: 500, lowerDepth: 280, plinthHeight: 0,
  worktopOverhang: 0, backsplashHeight: 0,
  upperElevation: 800, upperHeight: 300, upperDepth: 200,
} as const

export function selectWorktopMaterials(materials: readonly Material[]): Material[] {
  return materials.filter((material) => material.slab)
}

export function updateWizardLayout<T extends { layout: WizardLayout; modules: M | null }, M>(draft: T, layout: WizardLayout): T {
  return layout === draft.layout ? draft : { ...draft, layout, modules: null }
}

export function validateWizardDraft(draft: WizardDimensions, materials: readonly Material[]): { field: string; message: string } | null {
  const wallKeys: ('lengthA' | 'lengthB' | 'lengthC')[] = ['lengthA']
  if (draft.layout !== 'straight') wallKeys.push('lengthB')
  if (draft.layout === 'u') wallKeys.push('lengthC')
  for (const field of wallKeys) {
    const value = draft[field]
    if (!Number.isSafeInteger(value) || value < 600 || value > KITCHEN_WALL_UI_MAX) {
      return { field, message: `${field}: целые мм, 600–20 000 мм` }
    }
  }
  for (const [field, min] of Object.entries(dimensionMinimums) as [keyof typeof dimensionMinimums, number][]) {
    const value = draft[field]
    if (!Number.isSafeInteger(value) || value < min) {
      return { field, message: `${field}: целые мм, ${min}–${Number.MAX_SAFE_INTEGER} мм` }
    }
  }
  if (draft.worktopId && !selectWorktopMaterials(materials).some((material) => material.id === draft.worktopId)) {
    return { field: 'materials.worktopId', message: 'materials.worktopId: выберите материал категории slab' }
  }
  return null
}

/** Hidden wall fields must not block generation after changing the layout. */
export function visibleWizardDraftErrors(errors: Readonly<Record<string, boolean>>, layout: WizardLayout): Record<string, boolean> {
  return Object.fromEntries(Object.entries(errors).filter(([field]) =>
    (layout !== 'straight' || (field !== 'lengthB' && !field.startsWith('runB.'))) &&
    (layout === 'u' || field !== 'lengthC')))
}
