import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFPage } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { assemblyDrawingPdf, defaultShopProfile, findTemplate, formatCutList, generateCabinet, templateToCabinet } from '../src/core/index'
import type { Panel } from '../src/core/index'

const font = (name: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../public/fonts/${name}`, import.meta.url))))
const fonts = { regular: font('DejaVuSans-subset.ttf'), bold: font('DejaVuSans-Bold-subset.ttf') }

describe('жобалық PDF еркін тақталарды қамтиды', () => {
  it('шкаф проекциясын сақтап, еркін тақтаны деталировка және тесік бетіне шығарады', async () => {
    const shop = defaultShopProfile()
    const catalog = { materials: shop.materials, edgeBands: shop.edgeBands }
    const cabinet = templateToCabinet(findTemplate('wardrobe-3sec-1800')!, catalog)
    const panels = generateCabinet(cabinet, catalog)
    const freeBoard: Panel = {
      ...panels[0]!, id: 'free-board', label: 'Сынақ тақта Ә',
      finishedLength: 600, finishedWidth: 200, cutLength: 596, cutWidth: 200,
      drilling: [{ face: 'inner', x: 128, y: 64, diameter: 8, depth: 16, purpose: 'confirmat' }],
    }
    const spy = vi.spyOn(PDFPage.prototype, 'drawText')
    try {
      const bytes = await assemblyDrawingPdf({
        cabinet, panels, supplementaryPanels: [freeBoard], catalog, projectName: 'Жоба', fonts,
      })
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(4)
      const content = spy.mock.calls.map(([value]) => value).join('\n')
      expect(content).toContain(`Позиций: ${formatCutList([...panels, freeBoard], catalog).length}`)
      expect(content).toContain('Сынақ тақта Ә')
      expect(content).toContain('596')
      expect(content).toContain('128')
      expect(content).toContain('64')
    } finally {
      spy.mockRestore()
    }
  })
})
