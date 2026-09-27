'use client'

/**
 * Экспорт батырмалары (PHASE-2 A5). Файл БРАУЗЕРДЕ жасалады — ядро таза TS
 * болғандықтан, серверге барудың қажеті жоқ.
 *
 * Ауыр кітапханалар (pdf-lib, fflate) басу кезінде ғана жүктеледі: C1 бандл
 * бюджеті 500 КБ, ал pdf-lib жалғыз өзі соның жартысын жеп қояды.
 */

import { t as tr } from '@/lib/i18n'
import { useState } from 'react'
import { Menu, MenuItem } from '@/components/ui'
import { useConfigurator } from '@/store/configurator'
import { runShopExport, type ShopExportFormat } from '@/lib/shopExport'
import { selectShopExportPanels, type ShopExportScope } from '@/lib/shopExportScope'
import type { CabinetConfig, Panel } from '@/src/core/index'

export function ExportMenu({ cabinet, panels, projectPanels, projectName, exportId, exportName }: {
  cabinet?: CabinetConfig | undefined; panels: Panel[]; projectPanels?: Panel[]; projectName?: string; exportId?: string; exportName?: string
}) {
  const catalog = useConfigurator((s) => s.catalog)
  const projectInfo = useConfigurator((s) => s.projectInfo)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const [busy, setBusy] = useState<string | null>(null)

  // Логика `lib/shopExport.ts`-те: классикалық «Файл» мәзірі де соны тікелей шақырады.
  const run = async (format: ShopExportFormat, scope: ShopExportScope) => {
    setBusy(format)
    try {
      await runShopExport(format, {
        cabinet: scope === 'cabinet' ? cabinet : undefined,
        panels: selectShopExportPanels(scope, format, panels, projectPanels ?? panels),
        catalog, settings, projectInfo,
        exportId: scope === 'project' ? 'project' : exportId,
        exportName: scope === 'project' ? projectName : exportName,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div data-tour="export">
      <Menu label={busy ? '…' : tr('Экспорт')} title={tr('Скачать файлы для цеха')} align="right">
        {projectPanels ? <div className="border-b border-neutral-200 px-2 py-1 text-xs">{tr('Весь проект')}</div> : null}
        <MenuItem disabled={busy !== null} onClick={() => void run('xlsx', projectPanels ? 'project' : 'cabinet')}>
          XLSX — {tr('деталировка')}
        </MenuItem>
        <MenuItem disabled={busy !== null} onClick={() => void run('csv', projectPanels ? 'project' : 'cabinet')}>
          CSV — {tr('на распил')}
        </MenuItem>
        <MenuItem disabled={busy !== null} title={tr('DXF деталей и торцевая присадка CSV в одном архиве')} onClick={() => void run('dxf', projectPanels ? 'project' : 'cabinet')}>
          DXF — {tr('на станок')}
        </MenuItem>
        {cabinet && projectPanels ? <div className="border-b border-neutral-200 px-2 py-1 text-xs">{tr('Активный корпус')}</div> : null}
        {cabinet && projectPanels ? (['xlsx', 'csv', 'dxf'] as const).map((format) => <MenuItem key={format} disabled={busy !== null} onClick={() => void run(format, 'cabinet')}>{format.toUpperCase()} — {tr('Активный корпус')}</MenuItem>) : null}
        {cabinet && <MenuItem disabled={busy !== null} title={tr('Проекции, сборка и деталировка')} onClick={() => void run('pdf', 'cabinet')}>
          PDF — {tr('сборочный чертёж')}
        </MenuItem>}
      </Menu>
    </div>
  )
}
