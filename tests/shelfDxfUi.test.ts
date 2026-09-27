import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('all browser part DXF archive paths include edge drilling', () => {
  it('uses the archive exporter in both cut page packages and describes it in the menu', () => {
    const cutPage = readFileSync(new URL('../components/CutPage.tsx', import.meta.url), 'utf8')
    const exportMenu = readFileSync(new URL('../components/ExportMenu.tsx', import.meta.url), 'utf8')
    expect(cutPage.match(/flatArchiveFiles\(cabinetToDxfArchiveFiles\(panels, dxfOptions\)\)/g)).toHaveLength(2)
    expect(cutPage).not.toContain('cabinetToDxfFiles(')
    expect(exportMenu).toContain('DXF: плоские пласти; торец в EDGE-DRILLING.csv этого архива')
  })
})
