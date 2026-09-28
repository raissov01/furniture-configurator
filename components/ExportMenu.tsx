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

export function ExportMenu({ cabinet, pdfCabinet, pdfAssembly, panels, projectPanels, projectName, exportId, exportName, inline = false }: {
  cabinet?: CabinetConfig | undefined; pdfCabinet?: CabinetConfig | undefined
  pdfAssembly?: { nodeId: string; panels: Panel[]; nodeCount: number } | undefined
  panels: Panel[]; projectPanels?: Panel[]; projectName?: string; exportId?: string; exportName?: string
  inline?: boolean
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
        cabinet: format === 'pdf' ? (scope === 'project' ? pdfCabinet : cabinet) : scope === 'cabinet' ? cabinet : undefined,
        panels: selectShopExportPanels(scope, format, panels, projectPanels ?? panels),
        pdfAssembly: scope === 'project' ? pdfAssembly : undefined,
        catalog, settings, projectInfo,
        exportId: scope === 'project' ? 'project' : exportId,
        exportName: scope === 'project' ? projectName : exportName,
      })
    } finally {
      setBusy(null)
    }
  }

  const items = <>
        {projectPanels ? <div className="border-b border-neutral-200 px-2 py-1 text-xs">{tr('Весь проект')}</div> : null}
        <MenuItem disabled={busy !== null} onClick={() => void run('xlsx', projectPanels ? 'project' : 'cabinet')}>
          XLSX — {tr('деталировка')}
        </MenuItem>
        <MenuItem disabled={busy !== null} onClick={() => void run('csv', projectPanels ? 'project' : 'cabinet')}>
          CSV — {tr('на распил')}
        </MenuItem>
        <MenuItem disabled={busy !== null} title={tr('DXF: плоские пласти; торец в EDGE-DRILLING.csv этого архива. Полный ЧПУ CSV — в раскрое.')} onClick={() => void run('dxf', projectPanels ? 'project' : 'cabinet')}>
          DXF — {tr('на станок')}
        </MenuItem>
        <p className="px-2 py-1 text-[11px] text-neutral-500">
          {tr('DXF — пласти; торец — EDGE-DRILLING.csv. Полный ЧПУ CSV:')}{' '}
          <a href="/cut" className="underline">{tr('ЧПУ по деталям')}</a>
        </p>
        {projectPanels && pdfCabinet && <MenuItem disabled={busy !== null} onClick={() => void run('pdf', 'project')}>
          PDF — {tr('Весь проект')}
        </MenuItem>}
        {cabinet && projectPanels ? <div className="border-b border-neutral-200 px-2 py-1 text-xs">{tr('Активный корпус')}</div> : null}
        {cabinet && projectPanels ? (['xlsx', 'csv', 'dxf'] as const).map((format) => <MenuItem key={format} disabled={busy !== null}
          {...(format === 'dxf' ? { title: tr('DXF: плоские пласти; торец в EDGE-DRILLING.csv этого архива') } : {})}
          onClick={() => void run(format, 'cabinet')}>{format.toUpperCase()} — {tr('Активный корпус')}</MenuItem>) : null}
        {cabinet && <MenuItem disabled={busy !== null} title={tr('Проекции, сборка и деталировка')} onClick={() => void run('pdf', 'cabinet')}>
          PDF — {tr('сборочный чертёж')}
        </MenuItem>}
  </>

  if (inline) return items
  return <div data-tour="export">
    <Menu label={busy ? '…' : tr('Экспорт')} title={tr('Скачать файлы для цеха')} align="right">{items}</Menu>
  </div>
}
