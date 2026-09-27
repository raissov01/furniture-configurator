import { previewTreeMaterialReplace } from '@/src/core/index'
import type { Catalog, GroupNode, Layer, ReplaceMaterialScope, SettingsOverride, ShopProfile, TreeMaterialReplacePreview } from '@/src/core/index'

type PreviewInput = {
  root: GroupNode
  catalog: Catalog
  shop: ShopProfile
  oldMaterialId: string | null
  newMaterialId: string | null
  scope: ReplaceMaterialScope
  settings?: SettingsOverride
  layers?: Layer[]
}

export function buildMaterialPreview(input: PreviewInput): TreeMaterialReplacePreview | null {
  const { root, catalog, shop, oldMaterialId, newMaterialId, scope, settings, layers } = input
  if (!oldMaterialId || !newMaterialId || oldMaterialId === newMaterialId) return null
  if (scope.kind === 'cabinets' && scope.cabinetIds.length === 0) return null
  return previewTreeMaterialReplace(root, catalog, shop, oldMaterialId, newMaterialId,
    scope, settings ?? shop.settings, layers)
}

export function canApplyMaterialPreview(preview: TreeMaterialReplacePreview | null): boolean {
  return preview !== null && preview.changedPanels > 0
}
