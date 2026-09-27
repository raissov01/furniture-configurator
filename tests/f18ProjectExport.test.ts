import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import { runShopExport } from '@/lib/shopExport'
import { selectShopExportPanels } from '@/lib/shopExportScope'
import { splitProjectPdfPanels } from '@/lib/projectPdfScope'
import { projectProduction } from '@/lib/projectProduction'
import { flattenTree } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { referenceProject } from './fixtures'

describe('F18 бүкіл жоба экспорты', () => {
  it('екі корпустың 22 панелін CSV/XLSX/DXF/PDF ауқымына береді', async () => {
    const store = useConfigurator.getState()
    store.loadProject(referenceProject)
    store.duplicateCabinet(referenceProject.cabinets[0]!.id)
    const state = useConfigurator.getState()
    const scene = flattenTree(state.root, state.catalog, state.projectSettings ?? state.shop.settings, state.layers, state.autoJoints)
    const project = projectProduction(state.root, scene).panels
    const first = scene.nodes[0]!
    expect(project).toHaveLength(22)
    const fonts = {
      regular: readFileSync(new URL('../public/fonts/DejaVuSans-subset.ttf', import.meta.url)),
      bold: readFileSync(new URL('../public/fonts/DejaVuSans-Bold-subset.ttf', import.meta.url)),
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      arrayBuffer: async () => {
        const font = url.includes('Bold') ? fonts.bold : fonts.regular
        return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength)
      },
    })))
    try {
      for (const format of ['csv', 'xlsx', 'dxf', 'pdf'] as const) {
        const panels = selectShopExportPanels('project', format, first.panels, project)
        expect(panels).toHaveLength(22)
        let saved: string | Uint8Array | undefined
        await runShopExport(format, {
          cabinet: format === 'pdf' ? referenceProject.cabinets[0] : undefined,
          panels, catalog: state.catalog, settings: state.projectSettings ?? state.shop.settings,
          pdfAssembly: { nodeId: first.nodeId, panels: first.panels, nodeCount: scene.nodes.length },
        }, (_name, data) => { saved = data })
        expect(saved).toBeDefined()
        if (format === 'csv') {
          const rows = (saved as string).trim().split('\n').slice(1)
          expect(rows.reduce((sum, row) => sum + Number(row.match(/^.*?,\d+,\d+,(\d+),/)?.[1] ?? 0), 0)).toBe(22)
        } else if (format === 'xlsx') {
          const files = unzipSync(saved as Uint8Array)
          expect(strFromU8(files['xl/worksheets/sheet1.xml']!)).toContain('22')
        } else if (format === 'dxf') {
          const files = unzipSync(saved as Uint8Array)
          expect(Object.keys(files).filter((name) => name.endsWith('.dxf'))).toHaveLength(22)
        } else {
          expect(splitProjectPdfPanels(first.nodeId, first.panels, project, scene.nodes.length).supplementary).toHaveLength(11)
          expect((await PDFDocument.load(saved as Uint8Array)).getPageCount()).toBeGreaterThanOrEqual(3)
        }
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
