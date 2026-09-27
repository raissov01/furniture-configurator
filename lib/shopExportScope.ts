import type { Panel } from '@/src/core/index'
import type { ShopExportFormat } from '@/lib/shopExport'

export type ShopExportScope = 'project' | 'cabinet'

export function selectShopExportPanels(scope: ShopExportScope, format: ShopExportFormat, active: Panel[], project: Panel[]): Panel[] {
  if (scope === 'project') {
    if (format === 'pdf') throw new Error('PDF: сборочный чертёж доступен только для корпуса')
    return project
  }
  return active
}
