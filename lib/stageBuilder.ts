/** Бес қадам бір ғана драфтты өзгертеді; осы функциялар оны генераторға береді. */
import {
  furnitureMinWallLength, generateCabinet, generateFurniture, generateHardware, generateKitchen, mergeProjectPanels,
  nestPanels, nestingOptionsOf, priceProject, validatePlacements,
} from '@/src/core/index'
import type {
  Catalog, FurnitureOptions, FurnitureType, KitchenModule, KitchenOptions, Material,
  MillingPatternId, SettingsOverride, ShopProfile,
} from '@/src/core/index'
import { KITCHEN_WALL_UI_MAX } from './kitchenWallInput'
import { validateWizardDraft } from './kitchenWizardDraft'

export type StageDraft = {
  type: FurnitureType
  layout: 'straight' | 'corner' | 'u'
  lengthA: number; lengthB: number; lengthC: number
  sink: boolean; upper: boolean; appliances: boolean
  glassUpper: boolean; ledUpper: boolean
  hob: 'gas' | 'electric' | 'none'; hood: boolean
  lowerHeight: number; lowerDepth: number; plinthHeight: number
  upperDepth: number; upperHeight: number; upperElevation: number
  worktopOverhang: number; backsplashHeight: number
  carcassId: string; frontId: string; worktopId: string
  milling: MillingPatternId
  modules: { runA: KitchenModule[]; runB: KitchenModule[] } | null
}

export const DEFAULT_STAGE_DRAFT: StageDraft = {
  type: 'kitchen', layout: 'corner', lengthA: 3200, lengthB: 2400, lengthC: 2000,
  sink: true, upper: true, appliances: true, glassUpper: false, ledUpper: false,
  hob: 'gas', hood: true,
  lowerHeight: 720, lowerDepth: 500, plinthHeight: 95,
  upperDepth: 320, upperHeight: 720, upperElevation: 1460,
  worktopOverhang: 30, backsplashHeight: 600,
  carcassId: '', frontId: '', worktopId: '', milling: 'plain', modules: null,
}

export function stageOptions(d: StageDraft):
  { kind: 'kitchen'; options: KitchenOptions } | { kind: 'furniture'; options: FurnitureOptions } {
  if (d.type === 'kitchen') return {
    kind: 'kitchen',
    options: {
      layout: d.layout, lengthA: d.lengthA,
      lengthB: d.layout !== 'straight' ? d.lengthB : undefined,
      lengthC: d.layout === 'u' ? d.lengthC : undefined,
      sink: d.sink, upper: d.upper, appliances: d.appliances,
      glassUpper: d.glassUpper, ledUpper: d.ledUpper, hob: d.hob, hood: d.hood,
      dims: {
        lowerHeight: d.lowerHeight, lowerDepth: d.lowerDepth, plinthHeight: d.plinthHeight,
        upperDepth: d.upperDepth, upperHeight: d.upperHeight, upperElevation: d.upperElevation,
        worktopOverhang: d.worktopOverhang, backsplashHeight: d.backsplashHeight,
      },
      materials: {
        carcassId: d.carcassId || undefined, frontId: d.frontId || undefined,
        worktopId: d.worktopId || undefined,
      },
      milling: d.milling,
      modules: d.modules ?? undefined,
    },
  }
  return {
    kind: 'furniture',
    options: {
      type: d.type,
      layout: d.type === 'tv' || d.type === 'bedroom' || d.layout === 'u' ? 'straight' : d.layout,
      lengthA: d.lengthA,
      lengthB: d.layout === 'corner' && d.type !== 'tv' && d.type !== 'bedroom' ? d.lengthB : undefined,
      materials: { carcassId: d.carcassId || undefined, frontId: d.frontId || undefined },
    },
  }
}

export function validateStageDraft(d: StageDraft, materials: readonly Material[]): { field: string; message: string } | null {
  if (d.type === 'kitchen') return validateWizardDraft(d, materials)
  const walls = d.layout === 'corner' && d.type !== 'tv' && d.type !== 'bedroom'
    ? [['lengthA', d.lengthA], ['lengthB', d.lengthB]] as const
    : [['lengthA', d.lengthA]] as const
  for (const [field, value] of walls) {
    const minimum = field === 'lengthA' ? furnitureMinWallLength(d.type) : 600
    if (!Number.isSafeInteger(value) || value < minimum || value > KITCHEN_WALL_UI_MAX) {
      return { field, message: `${field}: целые мм, ${minimum}–${KITCHEN_WALL_UI_MAX} мм` }
    }
  }
  return null
}

/** Preview uses the exact generator, panels, nesting and pricing used by production. */
export function buildStagePreview(d: StageDraft, catalog: Catalog, shop: ShopProfile, settings?: SettingsOverride) {
  const source = stageOptions(d)
  const result = source.kind === 'kitchen'
    ? generateKitchen(source.options, catalog)
    : generateFurniture(source.options, catalog)
  const entries = result.cabinets.map((cabinet) => ({
    cabinet, placement: result.placements.find((placement) => placement.cabinetId === cabinet.id)!,
  }))
  const issues = validatePlacements(result.room, entries)
  const groups = result.cabinets.map((cabinet) => ({
    cabinetId: cabinet.id, panels: generateCabinet(cabinet, catalog, settings),
  }))
  const panels = mergeProjectPanels(groups)
  const hardware = result.cabinets.flatMap((cabinet) => generateHardware(cabinet, catalog, settings))
  const nesting = nestPanels(panels, catalog, nestingOptionsOf(shop))
  const price = priceProject(panels, nesting, shop, hardware, result.cabinets.map((cabinet) => cabinet.width))
  return { result, groups, panels, price, issues }
}
