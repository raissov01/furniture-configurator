/**
 * Аудит `docs/audit/drilling-2026-09-20.md` §O4, §O5, §O6 — DXF экспортының
 * үш ақауы (2026-09-20). Реті: О5 (ең қауіпті) → О6 → О4 (ең үлкен).
 */
import { describe, expect, it } from 'vitest'
import {
  cabinetToDxfFiles, drillLayerName, generateCabinet, mergeSettings, panelToDxf,
} from '../src/core/index'
import type { Panel } from '../src/core/index'
import { catalog, PVC2, referenceWardrobe } from './fixtures'

const panels = generateCabinet(referenceWardrobe, catalog)
const sideLeft = panels.find((p) => p.id === 'side-left')!

describe('O5 — Ø35 тесіктің ТЕРЕҢДІГІ DXF қабат атында болуы керек', () => {
  // Бір диаметр (Ø35), екі әртүрлі тереңдік: ілгек ұясы (12.5 мм, соқыр) мен
  // өтпелі тесік (16 мм — материал қалыңдығына тең, демек тесіп өтеді).
  const panel: Panel = {
    ...sideLeft,
    drilling: [
      { face: 'inner', x: 22, y: 100, diameter: 35, depth: 12.5, purpose: 'hinge' },
      { face: 'inner', x: 22, y: 300, diameter: 35, depth: 16, purpose: 'confirmat' },
    ],
    cutouts: [],
    grooves: [],
    milling: [],
  }
  const dxf = panelToDxf(panel)

  it('екі тесік БӨЛЕК қабатта — атында тереңдігі бар', () => {
    // Аудиттің ұсынысы: DRILL_35_D12_5 (§O5). Қазір екеуі де жай DRILL_35-ке
    // түседі де, ілгек ұясы мен өтпелі тесік бір станок қабатына байланады —
    // цех ілгектің тереңдігімен (12.5 мм) фасатты тесіп жіберуі мүмкін.
    expect(dxf).toContain('DRILL_35_D12_5')
    expect(dxf).toContain('DRILL_35_D16')
    expect(dxf).not.toMatch(/\nDRILL_35\n/) // тереңдіксіз ЕСКІ атау қалмауы керек
  })

  it('drillLayerName тереңдікті алады', () => {
    expect(drillLayerName(35, 12.5)).not.toBe(drillLayerName(35, 16))
  })
})
