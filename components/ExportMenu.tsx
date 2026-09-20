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
import { mergeSettings } from '@/src/core/index'
import type { CabinetConfig, Panel } from '@/src/core/index'

function download(filename: string, data: Uint8Array | string, mime: string): void {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportMenu({ cabinet, panels }: { cabinet: CabinetConfig; panels: Panel[] }) {
  const catalog = useConfigurator((s) => s.catalog)
  const projectInfo = useConfigurator((s) => s.projectInfo)
  const shop = useConfigurator((s) => s.shop)
  const [busy, setBusy] = useState<string | null>(null)
  const base = cabinet.id || 'cabinet'
  // §O6: ойма бар панельдің DXF рез координатасы үшін генерациямен ДӘЛ сол
  // catalog/settings керек (generateCabinet ішінде осылай құрастырылады).
  const dxfOptions = { catalog, settings: mergeSettings(shop.settings, cabinet.settings) }

  const run = async (kind: string, action: () => Promise<void> | void) => {
    setBusy(kind)
    try {
      await action()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div data-tour="export">
      <Menu label={busy ? '…' : tr('Экспорт')} title={tr('Скачать файлы для цеха')} align="right">
        <MenuItem
          disabled={busy !== null}
          onClick={() => run('xlsx', async () => {
            const { cutListToXlsx } = await import('@/src/core/export/xlsx')
            download(`${base}-cutlist.xlsx`, cutListToXlsx(panels, catalog, cabinet.name),
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          })}
        >
          XLSX — {tr('деталировка')}
        </MenuItem>
        <MenuItem
          disabled={busy !== null}
          onClick={() => run('csv', async () => {
            const { cutListToCsv } = await import('@/src/core/export/csv')
            download(`${base}-cutlist.csv`, cutListToCsv(panels, catalog), 'text/csv;charset=utf-8')
          })}
        >
          CSV — {tr('на распил')}
        </MenuItem>
        <MenuItem
          disabled={busy !== null}
          title={tr('Каждая деталь — отдельный DXF, всё в одном архиве')}
          onClick={() => run('dxf', async () => {
            const [{ cabinetToDxfFiles }, { zipSync, strToU8 }] = await Promise.all([
              import('@/src/core/export/dxf'),
              import('fflate'),
            ])
            const entries: Record<string, Uint8Array> = {}
            for (const [name, content] of cabinetToDxfFiles(panels, dxfOptions)) entries[name] = strToU8(content)
            download(`${base}-dxf.zip`, zipSync(entries, { level: 6, mtime: Date.UTC(1980, 0, 1) }),
              'application/zip')
          })}
        >
          DXF — {tr('на станок')}
        </MenuItem>
        <MenuItem
          disabled={busy !== null}
          title={tr('Проекции, сборка и деталировка')}
          onClick={() => run('pdf', async () => {
            const { assemblyDrawingPdf } = await import('@/src/core/export/pdf')
            const [regular, bold] = await Promise.all([
              fetch('/fonts/DejaVuSans-subset.ttf').then((r) => r.arrayBuffer()),
              fetch('/fonts/DejaVuSans-Bold-subset.ttf').then((r) => r.arrayBuffer()),
            ])
            const bytes = await assemblyDrawingPdf({
              cabinet, panels, catalog,
              projectName: cabinet.name,
              fonts: { regular: new Uint8Array(regular), bold: new Uint8Array(bold) },
              info: projectInfo,
            })
            download(`${base}-assembly.pdf`, bytes, 'application/pdf')
          })}
        >
          PDF — {tr('сборочный чертёж')}
        </MenuItem>
      </Menu>
    </div>
  )
}
