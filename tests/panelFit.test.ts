/**
 * Параққа сыймайтын деталь.
 *
 * Раскрой мұны бәрібір айтады, бірақ ол — басқа бет. Габаритті терген адам
 * «сыймайды» дегенді ДЕТАЛИРОВКАДА, теру кезінде көруі керек.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet, panelFitWarnings } from '../src/core/index'
import type { Catalog, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const small = (): Catalog => ({
  ...catalog,
  materials: catalog.materials.map((m) => ({ ...m, sheetWidth: 1200, sheetHeight: 800 })),
})

const tall = () => generateCabinet(withCabinet({
  height: 2400, width: 600, depth: 500,
  sections: [{ id: 's1', widthMode: 'flex', contents: [], fronts: null }],
}), catalog)

describe('сыймайтын деталь', () => {
  it('қалыпты параққа бәрі сыяды — ескерту жоқ', () => {
    expect(panelFitWarnings(tall(), catalog)).toEqual([])
  })

  it('кіші парақта БҮЙІР сыймайды', () => {
    const warnings = panelFitWarnings(tall(), small())
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some((w) => w.label.includes('Боковина'))).toBe(true)
    // Хабарда детальдің де, парақтың да өлшемі болуы керек — цех соны салыстырады.
    expect(warnings[0]!.message).toMatch(/\d+×\d+ мм/)
    expect(warnings[0]!.message).toMatch(/полезно/)
  })

  it('ТЕКСТУРА бұрылуға жол бермесе, ол да айтылады', () => {
    // Парақ 800 × 2600: бүйір (2400 × 447) бұрылса сыяр еді, бірақ текстура жібермейді.
    const grained: Catalog = {
      ...catalog,
      materials: catalog.materials.map((m) => ({
        ...m, hasGrain: true, sheetWidth: 800, sheetHeight: 2000,
      })),
    }
    const warnings = panelFitWarnings(tall(), grained)
    expect(warnings.some((w) => w.message.includes('текстура'))).toBe(true)
  })

  it('әр сыймайтын деталь БІР рет аталады', () => {
    const warnings = panelFitWarnings(tall(), small())
    expect(new Set(warnings.map((w) => w.panelId)).size).toBe(warnings.length)
  })

  it('белгісіз материал ҚҰЛАТПАЙДЫ', () => {
    const panels = tall().map((p: Panel) => ({ ...p, materialId: 'жоқ-материал' }))
    expect(panelFitWarnings(panels, catalog)).toEqual([])
  })
})
