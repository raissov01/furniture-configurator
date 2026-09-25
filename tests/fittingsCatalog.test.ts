import { describe, expect, it } from 'vitest'
import {
  FITTINGS_CATALOG, fittingById, fittingDrillingTable, parseFittingsCatalog, resolveHingeFrontPattern,
  requireRunnerPattern,
} from '../src/core/data/fittings'
import { hingeHoles, runnerHoles } from '../src/core/drilling'
import { defaultHingeSystems, hingeBrandName, HingeSystemSchema } from '../src/core/fittings'
import { DRAWER_SYSTEMS } from '../src/core/drawerSystems'
import { mergeSettings } from '../src/core/constants'
import { catalog, referenceWardrobe } from './fixtures'
import { generateCabinet } from '../src/core/generateCabinet'
import type { Drill } from '../src/core/types'

describe('өндіруші фурнитурасының присадка каталогы', () => {
  it('әр бұйымның операциясын және ресми дереккөзін сақтайды', () => {
    const expected: Record<string, [string, number | null][]> = {
      'blum-clip-top-110-overlay-inserta': [['blindCup', 35], ['blindSocket', 8.5], ['plateFixingReference', null]],
      'blum-clip-top-110-overlay-screw-on': [['blindCup', 35], ['plateFixingReference', null]],
      'blum-tandem-551h': [['runnerMounting', null], ['runnerFastener', null]],
      'blum-movento-760h-500': [['runnerMounting', null], ['runnerFastener', null]],
      'blum-legrabox-m-500': [['profileMounting', null], ['profileFastener', null]],
      'blum-aventos-hk-top': [['liftMechanismMounting', null], ['liftMechanismChipboardScrew', 4], ['frontBracket', null]],
      'blum-aventos-hf-hs-hl': [['liftMechanismMounting', null], ['frontBracket', null]],
      'hettich-sensys-8645i-overlay-screw': [['blindCup', 35], ['plateFixingReference', null]],
      'hettich-sensys-8645i-overlay-press-in': [['blindCup', 35], ['blindPressFitSocket', 8]],
      'hettich-quadro-v6-500': [['runnerMounting', null], ['runnerFastener', null]],
      'hettich-arcitech-actro-xl-550': [['runnerMounting', null], ['runnerFastener', null]],
      'boyard-h301-35mm-hinge': [['blindCup', 35], ['hingeFixingPattern', null]],
      'boyard-db7772-b-slide': [['runnerMounting', null]],
      'boyard-mb-roller-500': [['runnerMounting', null]],
      'gtv-zp-kt90h2ze-px': [['blindCup', 35], ['plateFixingReference', null]],
      'gtv-concealed-runner-family': [['runnerMounting', null]],
      'aks-prime-hinge-112595': [['blindCup', 35], ['hingeScrewOrEuroFixing', null]],
      'aks-prime-concealed-runner-113662': [['runnerMounting', null], ['drawerSideMount', 6]],
      'aks-h45-ball-114797': [['runnerMounting', null]],
      'aks-lifts-zevs-helios-kronos': [['liftMounting', null]],
    }
    expect(Object.keys(expected).sort()).toEqual(FITTINGS_CATALOG.products.map((p) => p.id).sort())
    for (const [id, rows] of Object.entries(expected)) {
      const table = fittingDrillingTable(id)
      expect(table.map((row) => [row.operation, row.diameterMm])).toEqual(rows)
      expect(table.every((row) => row.sources.length > 0 && row.sources.every((s) => s.url.startsWith('https://')))).toBe(true)
    }
  })

  it('Hettich press-in чашкасы мен екі Ø8×11 ұясын нақты мақала бойынша береді', () => {
    expect(resolveHingeFrontPattern('hettich-sensys-8645i-overlay-press-in', 22, 16, 'press-fit'))
      .toEqual([
        { along: 0, across: 0, diameter: 35, depth: 12.8 },
        { along: -22.5, across: 9.5, diameter: 8, depth: 11 },
        { along: 22.5, across: 9.5, diameter: 8, depth: 11 },
      ])
  })

  it('толық емес схема орнына бөтен жүйенің тесігін қолданбайды', () => {
    expect(() => resolveHingeFrontPattern('blum-clip-top-110-overlay-inserta', 22, 16, 'press-fit'))
      .toThrow(/blindSocket.*depthMm/)
    expect(() => requireRunnerPattern('blum-tandem-551h')).toThrow(/runnerMounting/)
    expect(fittingById('blum-tandem-551h')?.articleExamples).toContain('551H2601B')
  })

  it('дереккөз сілтемесі жоғалған және қайталанған id бар каталогты қабылдамайды', () => {
    const noSource = structuredClone(FITTINGS_CATALOG)
    noSource.products[0]!.drilling[0]!.sourceIds = ['missing-source']
    expect(() => parseFittingsCatalog(noSource)).toThrow(/дереккөз табылмады/)
    const duplicate = structuredClone(FITTINGS_CATALOG)
    duplicate.products.push(structuredClone(duplicate.products[0]!))
    expect(() => parseFittingsCatalog(duplicate)).toThrow(/қайталанған id/)
  })

  it('K диапазонынан тыс чашка орнын қабылдамайды', () => {
    expect(() => resolveHingeFrontPattern('blum-clip-top-110-overlay-screw-on', 30, 16, 'cup-only'))
      .toThrow(/K = 12.5/)
  })

  it('әр топса мақаласының жарияланған фасад тесігін немесе жетіспейтін мәнін көрсетеді', () => {
    const cupCases: Array<[string, number, number]> = [
      ['blum-clip-top-110-overlay-inserta', 35, 13],
      ['blum-clip-top-110-overlay-screw-on', 35, 13],
      ['hettich-sensys-8645i-overlay-screw', 35, 12.8],
      ['hettich-sensys-8645i-overlay-press-in', 35, 12.8],
      ['boyard-h301-35mm-hinge', 35, 12],
      ['aks-prime-hinge-112595', 35, 12],
    ]
    for (const [id, diameter, depth] of cupCases) {
      expect(resolveHingeFrontPattern(id, 22, 16, 'cup-only'))
        .toEqual([{ along: 0, across: 0, diameter, depth }])
    }
    expect(() => resolveHingeFrontPattern('gtv-zp-kt90h2ze-px', 22, 16, 'cup-only'))
      .toThrow(/blindCup.depthMm/)
    expect(hingeBrandName('aks')).toBe('AKS')
  })

  it('drilling.ts таңдалған Hettich мақаласының Ø8 ұяларын қолданады', () => {
    const front = { ...generateCabinet(referenceWardrobe, catalog).find((panel) => panel.role === 'front')!, drilling: [] as Drill[] }
    const system = {
      ...defaultHingeSystems().find((item) => item.brand === 'hettich')!,
      fittingProductId: 'hettich-sensys-8645i-overlay-press-in',
    }
    const ctx = {
      settings: mergeSettings({ hingeCupMount: 'press-fit' as const }),
      bands: new Map(catalog.edgeBands.map((band) => [band.id, band])),
      thickness: () => 16,
    }
    hingeHoles(front, undefined, 'left', ctx, system)
    const first = front.drilling.slice(0, 3)
    expect(first.map((hole) => [hole.diameter, hole.depth])).toEqual([[35, 12.8], [8, 11], [8, 11]])
    expect(first.every((hole) => hole.hardwareId === system.fittingProductId)).toBe(true)
    expect(first[1]!.x - first[0]!.x).toBe(-22.5)
    expect(first[2]!.x - first[0]!.x).toBe(22.5)
    expect(HingeSystemSchema.parse(system).fittingProductId).toBe(system.fittingProductId)
  })

  it('толық емес runner схемасы drilling.ts ішінде қате беріп, панельді өзгертпейді', () => {
    const side = { ...generateCabinet(referenceWardrobe, catalog).find((panel) => panel.id === 'side-left')!, drilling: [] as Drill[] }
    const ctx = {
      settings: mergeSettings(),
      bands: new Map(catalog.edgeBands.map((band) => [band.id, band])),
      thickness: () => 16,
    }
    expect(() => runnerHoles(side, 100, 0, 500, 300, ctx, {
      ...DRAWER_SYSTEMS.tandem, fittingProductId: 'blum-tandem-551h',
    })).toThrow(/runnerMounting/)
    expect(side.drilling).toEqual([])
  })

  it('жауап планканың сызбасы толық болмаса екі панельдің де тесігін өзгертпейді', () => {
    const panels = generateCabinet(referenceWardrobe, catalog)
    const front = { ...panels.find((panel) => panel.role === 'front')!, drilling: [] as Drill[] }
    const side = { ...panels.find((panel) => panel.id === 'side-left')!, drilling: [] as Drill[] }
    const ctx = {
      settings: mergeSettings({ hingeCupMount: 'press-fit' as const }),
      bands: new Map(catalog.edgeBands.map((band) => [band.id, band])),
      thickness: () => 16,
    }
    expect(() => hingeHoles(front, side, 'left', ctx, {
      ...defaultHingeSystems().find((item) => item.brand === 'hettich')!,
      fittingProductId: 'hettich-sensys-8645i-overlay-press-in',
    })).toThrow(/plateFixingReference/)
    expect(front.drilling).toEqual([])
    expect(side.drilling).toEqual([])
  })
})
