/**
 * Цехқа экспорт (XLSX/CSV/DXF/PDF) — БІР функция.
 *
 * Бұрын логика тек `ExportMenu` ішінде тұратын, ал классикалық «Файл →
 * Экспорт для цеха» сол мәзірдің жасырын батырмасын `.click()` ететін. Header
 * классикалық режимде `display:none` — пункт ештеңе ашпайтын (аудит P0-1).
 * Енді екеуі де осы функцияны тікелей шақырады.
 *
 * Ауыр кітапханалар (pdf-lib, fflate) басу кезінде ғана жүктеледі.
 */

import { mergeSettings } from '@/src/core/index'
import type { CabinetConfig, Catalog, Panel, ProjectInfo, SettingsOverride } from '@/src/core/index'
import { flatArchiveFiles } from '@/lib/flatArchiveFiles'
import { splitProjectPdfPanels } from '@/lib/projectPdfScope'

export type ShopExportFormat = 'xlsx' | 'csv' | 'dxf' | 'pdf'
export const SHOP_EXPORT_FORMATS: readonly ShopExportFormat[] = ['xlsx', 'csv', 'dxf', 'pdf']

export type SaveFile = (filename: string, data: Uint8Array | string, mime: string) => void

export type ShopExportInput = {
  cabinet?: CabinetConfig | undefined
  panels: Panel[]
  catalog: Catalog
  settings?: SettingsOverride | undefined
  projectInfo?: ProjectInfo | undefined
  exportId?: string | undefined
  exportName?: string | undefined
  pdfAssembly?: { nodeId: string; panels: Panel[]; nodeCount: number } | undefined
}

export function shopExportFileName(base: string, format: ShopExportFormat): string {
  switch (format) {
    case 'xlsx': return `${base}-cutlist.xlsx`
    case 'csv': return `${base}-cutlist.csv`
    case 'dxf': return `${base}-dxf.zip`
    case 'pdf': return `${base}-assembly.pdf`
  }
}

/** Браузерде файлды жүктеп алу. */
export const downloadFile: SaveFile = (filename, data, mime) => {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function runShopExport(format: ShopExportFormat, input: ShopExportInput, save: SaveFile = downloadFile): Promise<void> {
  const { cabinet, panels, catalog } = input
  const base = input.exportId ?? cabinet?.id ?? 'part'
  const name = shopExportFileName(base, format)
  switch (format) {
    case 'xlsx': {
      const { cutListToXlsx } = await import('@/src/core/export/xlsx')
      save(name, cutListToXlsx(panels, catalog, cabinet?.name ?? input.exportName ?? base),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      return
    }
    case 'csv': {
      const { cutListToCsv } = await import('@/src/core/export/csv')
      save(name, cutListToCsv(panels, catalog), 'text/csv;charset=utf-8')
      return
    }
    case 'dxf': {
      // §O6: ойма бар панельдің DXF рез координатасы үшін генерациямен ДӘЛ сол
      // catalog/settings керек (generateCabinet ішінде осылай құрастырылады).
      const dxfOptions = { catalog, settings: mergeSettings(input.settings, cabinet?.settings) }
      const [{ cabinetToDxfArchiveFiles }, { zipSync, strToU8 }] = await Promise.all([
        import('@/src/core/export/dxf'),
        import('fflate'),
      ])
      const entries: Record<string, Uint8Array> = {}
      for (const [file, content] of flatArchiveFiles(cabinetToDxfArchiveFiles(panels, dxfOptions))) entries[file] = strToU8(content)
      save(name, zipSync(entries, { level: 6, mtime: Date.UTC(1980, 0, 1) }), 'application/zip')
      return
    }
    case 'pdf': {
      if (!cabinet) throw new Error('PDF: сборочный чертёж строится только для корпуса')
      const scope = input.pdfAssembly
        ? splitProjectPdfPanels(input.pdfAssembly.nodeId, input.pdfAssembly.panels, panels, input.pdfAssembly.nodeCount)
        : { assembly: panels, supplementary: [] }
      const { assemblyDrawingPdf } = await import('@/src/core/export/pdf')
      const [regular, bold] = await Promise.all([
        fetch('/fonts/DejaVuSans-subset.ttf').then((r) => r.arrayBuffer()),
        fetch('/fonts/DejaVuSans-Bold-subset.ttf').then((r) => r.arrayBuffer()),
      ])
      const bytes = await assemblyDrawingPdf({
        cabinet, panels: scope.assembly, supplementaryPanels: scope.supplementary, catalog,
        projectName: input.exportName ?? cabinet.name,
        fonts: { regular: new Uint8Array(regular), bold: new Uint8Array(bold) },
        info: input.projectInfo,
      })
      save(name, bytes, 'application/pdf')
      return
    }
  }
}
