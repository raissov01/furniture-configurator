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
import type { CabinetConfig, Panel } from '@/src/core/index'

export function ExportMenu({ cabinet, panels, exportId, exportName }: {
  cabinet?: CabinetConfig; panels: Panel[]; exportId?: string; exportName?: string
}) {
  const catalog = useConfigurator((s) => s.catalog)
  const projectInfo = useConfigurator((s) => s.projectInfo)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const [busy, setBusy] = useState<string | null>(null)

  // Логика `lib/shopExport.ts`-те: классикалық «Файл» мәзірі де соны тікелей шақырады.
  const run = async (format: ShopExportFormat) => {
    setBusy(format)
    try {
      await runShopExport(format, { cabinet, panels, catalog, settings, projectInfo, exportId, exportName })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div data-tour="export">
      <Menu label={busy ? '…' : tr('Экспорт')} title={tr('Скачать файлы для цеха')} align="right">
        <MenuItem disabled={busy !== null} onClick={() => void run('xlsx')}>
          XLSX — {tr('деталировка')}
        </MenuItem>
        <MenuItem disabled={busy !== null} onClick={() => void run('csv')}>
          CSV — {tr('на распил')}
        </MenuItem>
        <MenuItem disabled={busy !== null} title={tr('Каждая деталь — отдельный DXF, всё в одном архиве')} onClick={() => void run('dxf')}>
          DXF — {tr('на станок')}
        </MenuItem>
        {cabinet && <MenuItem disabled={busy !== null} title={tr('Проекции, сборка и деталировка')} onClick={() => void run('pdf')}>
          PDF — {tr('сборочный чертёж')}
        </MenuItem>}
      </Menu>
    </div>
  )
}
