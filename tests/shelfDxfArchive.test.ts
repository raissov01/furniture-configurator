import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { generateCabinet } from '../src/core/index'
import { cabinetToDxfArchiveFiles } from '../src/core/export/dxf'
import { runShopExport } from '../lib/shopExport'
import { catalog, referenceWardrobe } from './fixtures'

const fixedWardrobe = () => ({
  ...referenceWardrobe,
  sections: referenceWardrobe.sections.map((section) => ({
    ...section,
    contents: section.contents.map((content) => content.kind === 'shelves'
      ? { ...content, shelfKind: 'fixed' as const }
      : content),
  })),
})

describe('F04: DXF archive edge drilling', () => {
  it('includes fixed shelf edge pilots with panel IDs and cut coordinates', () => {
    const panels = generateCabinet(fixedWardrobe(), catalog)
    const shelf = panels.find((panel) => panel.role === 'shelf')!
    const pilot = shelf.drilling.find((drill) => drill.face.startsWith('edge') && drill.purpose === 'confirmat')!
    expect(pilot).toBeDefined()

    const files = cabinetToDxfArchiveFiles(panels)
    expect(files.get(`${shelf.id}.dxf`)).toBeDefined()
    expect(files.get('EDGE-DRILLING.csv')).toContain(
      [shelf.id, shelf.label, pilot.face, pilot.x, pilot.y, pilot.diameter, pilot.depth, pilot.purpose].join(','),
    )
    expect(files.get('README.txt')).toMatch(/EDGE-DRILLING\.csv.*торц/s)
  })

  it('puts the edge operation file into the downloaded shop DXF ZIP', async () => {
    const cabinet = fixedWardrobe()
    const panels = generateCabinet(cabinet, catalog)
    let zip: Uint8Array | undefined
    await runShopExport('dxf', { cabinet, panels, catalog }, (_name, data) => {
      if (data instanceof Uint8Array) zip = data
    })
    expect(zip).toBeDefined()
    const entries = unzipSync(zip!)
    const edgeCsv = strFromU8(entries['EDGE-DRILLING.csv']!)
    expect(edgeCsv).toContain('edgeW1')
    expect(edgeCsv).toContain('confirmat')
    expect(strFromU8(entries['README.txt']!)).toMatch(/торц/)
  })
})
