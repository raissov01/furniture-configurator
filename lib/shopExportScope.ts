import type { Panel } from '@/src/core/index'
import type { ShopExportFormat } from '@/lib/shopExport'

export type ShopExportScope = 'project' | 'cabinet'

export function selectShopExportPanels(scope: ShopExportScope, _format: ShopExportFormat, active: Panel[], project: Panel[]): Panel[] {
  if (scope === 'project') {
    return project
  }
  return active
}
