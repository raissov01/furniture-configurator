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

describe('O6 — ойманың РЕЗ координатасы присадкамен БІР басынан саналуы керек', () => {
  // W1/L1 жағында ғана 2 мм кромка бар, W2/L2-де ЖОҚ — присадка (cutOrigin,
  // drilling.ts:455-463) бұл жағдайда тек W1/L1-ді шегереді, СИММЕТРИЯЛЫ
  // ЕМЕС. dxf.ts қазір (finishedLength − cutLength)/2 санайды, яғни екі
  // жағынан теңдей — бұл дұрыс емес (§O6 аудит).
  const panel: Panel = {
    ...sideLeft,
    finishedLength: 1000,
    finishedWidth: 600,
    cutLength: 998, // 1000 − t(W1)2 − t(W2)0
    cutWidth: 598, // 600 − t(L1)2 − t(L2)0
    edges: {
      W1: { bandId: PVC2 }, W2: null,
      L1: { bandId: PVC2 }, L2: null,
    },
    drilling: [],
    grooves: [],
    milling: [],
    cutouts: [{ id: 'c1', shape: 'circle', corner: 'bottomLeft', x: 100, y: 100, diameter: 68 }],
  }

  it('присадканың cutOrigin-імен ДӘЛ сәйкес: тек W1/L1 шегеріледі', () => {
    const settings = mergeSettings()
    const dxf = panelToDxf(panel, { catalog, settings })
    // Дұрыс орталық: 66 − t(W1)2 + 34 = 98 (әр өс бойынша).
    // Ескі (симметриялы) формула (99, 99) берер еді — 1 мм жылжу, бірақ
    // мойка/розетка ойымында бұл тесіктерге қарағанда «көзге көрінбейтін»
    // ауытқу емес, нақты дефект.
    expect(dxf).toContain('CIRCLE\n8\nCUTOUT\n10\n98.0\n20\n98.0')
    expect(dxf).not.toContain('CIRCLE\n8\nCUTOUT\n10\n99.0\n20\n99.0')
  })

  it('ойма бар да, catalog/settings берілмесе — ҚАТЕ (үнсіз қате санамайды)', () => {
    expect(() => panelToDxf(panel)).toThrow()
    expect(() => cabinetToDxfFiles([panel])).toThrow()
  })
})
