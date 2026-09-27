import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, cabinetToDxfFiles, findTemplate, generateCabinet, mergeSettings,
  planWorktopCutout, templateToCabinet, worktopFixtureModel,
} from '../src/core/index'

const base = () => templateToCabinet(findTemplate('kitchen-base-full-600')!, SEED_CATALOG)

describe('өндіруші сызбасындағы үстелтақта ойықтары', () => {
  it('60 см плита әдепкісі 560 × 490 R5, алдыңғы 55 және артқы 50 мм', () => {
    const model = worktopFixtureModel('hob-60-default')
    expect(model).toMatchObject({ width: 560, depth: 490, radius: 5,
      minFront: 55, minBack: 50, minCabinetWidth: 600 })
    expect(planWorktopCutout(model, { panelLength: 600, panelWidth: 600,
      centreX: 300, cabinetWidth: 600 })).toMatchObject({
      shape: 'rect', x: 20, y: 55, width: 560, height: 490, radius: 5,
    })
    expect(() => planWorktopCutout(model, { panelLength: 600, panelWidth: 594,
      centreX: 300, cabinetWidth: 600 })).toThrow(/panelWidth.*≥ 595/)
  })

  it('мойка ойығы артикул мен алдыңғы шегіністі талап етеді', () => {
    const blanco = worktopFixtureModel('blanco-522201')
    const franke = worktopFixtureModel('franke-1140067723')
    expect(blanco).toMatchObject({ width: 760, depth: 480, radius: 15, minCabinetWidth: 450 })
    expect(franke).toMatchObject({ width: 950, depth: 480, minCabinetWidth: 600 })
    expect(() => planWorktopCutout(blanco, { panelLength: 800, panelWidth: 600,
      centreX: 400, cabinetWidth: 800 })).toThrow(/frontInset/)
    expect(planWorktopCutout(blanco, { panelLength: 800, panelWidth: 600,
      centreX: 400, cabinetWidth: 800, frontInset: 60 })).toMatchObject({
      x: 20, y: 60, width: 760, height: 480, radius: 15,
    })
  })

  it('плита ойығы бір деректен деталировкаға және DXF-ке өтеді', () => {
    const cabinet = { ...base(), depth: 570,
      worktop: { overhangFront: 30, overhangSides: 0 },
      fixtures: [{ kind: 'hob' as const, fuel: 'electric' as const }] }
    const panels = generateCabinet(cabinet, SEED_CATALOG)
    const top = panels.find((p) => p.id === 'worktop')!
    expect(top.cutouts).toMatchObject([{ width: 560, height: 490, radius: 5 }])
    expect(top.note).toContain('Вырезы')
    expect(cabinetToDxfFiles(panels, { catalog: SEED_CATALOG,
      settings: mergeSettings() }).get('worktop.dxf')).toContain('CUTOUT')
  })
})
