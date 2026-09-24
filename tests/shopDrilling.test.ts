import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import baseline from './fixtures/shop-drill-seed-baseline.json'
import {
  DEFAULT_SETTINGS, SEED_TEMPLATES, catalogOf, defaultShopProfile, generateCabinet,
  mergeSettings, parseShopProfile, templateToCabinet,
} from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const panelsFor = (id: string, settings = shop.settings) => {
  const template = SEED_TEMPLATES.find((item) => item.id === id)
  if (!template) throw new Error(`missing template ${id}`)
  return generateCabinet(templateToCabinet(template, catalog), catalog, settings)
}

describe('цех присадка профилі', () => {
  it('v7 профилін v8-ге көтергенде бұрынғы баға мен мәндерін сақтайды', () => {
    const old = {
      ...shop, schemaVersion: 7, name: 'Сақталған цех',
      settings: { shelfPinDatum: 37 },
      materials: shop.materials.map((material) => ({ ...material, pricePerSheet: 123456 })),
    }
    const loaded = parseShopProfile(old)
    expect(loaded.schemaVersion).toBe(8)
    expect(loaded.settings.shelfPinDatum).toBe(37)
    expect(loaded.materials[0]?.pricePerSheet).toBe(123456)
    expect(mergeSettings(loaded.settings).shelfPinFrontOffset).toBe(37)
    expect(mergeSettings(loaded.settings).outerFlipAxis).toBe('length')
    expect(mergeSettings(loaded.settings).hingeScrewPilotDepth).toBeNull()
    expect(mergeSettings(loaded.settings).hingeScrewPilotDiameter).toBeNull()
  })

  it('v8-де бұрғылау мәндерінің шегін тексереді', () => {
    expect(() => parseShopProfile({ ...shop, settings: { shelfPinFrontOffset: -1 } })).toThrow()
    expect(() => parseShopProfile({ ...shop, settings: { outerFlipAxis: 'diagonal' } })).toThrow()
    expect(() => parseShopProfile({ ...shop, settings: { runnerRollerHoleOffsets: [0] } })).toThrow()
  })

  it('әдепкі профиль барлық seed шаблонның присадкасын сақтайды', () => {
    const actual = Object.fromEntries(SEED_TEMPLATES.map((template) => [
      template.id,
      generateCabinet(templateToCabinet(template, catalog), catalog, shop.settings)
        .map((panel) => ({ id: panel.id, drilling: panel.drilling })),
    ]))
    expect(Object.fromEntries(Object.entries(actual).map(([id, panels]) => [
      id, createHash('sha256').update(JSON.stringify(panels)).digest('hex'),
    ]))).toEqual(baseline)
  })

  it('полкодержательдің алдыңғы бағанын цех мәніне жылжытады', () => {
    const original = panelsFor('wardrobe-penal-600')
    const shifted = panelsFor('wardrobe-penal-600', { shelfPinFrontOffset: 50 })
    const a = original.find((p) => p.id.includes('side-left'))!.drilling.filter((d) => d.purpose === 'shelfPin')
    const b = shifted.find((p) => p.id.includes('side-left'))!.drilling.filter((d) => d.purpose === 'shelfPin')
    expect(b).toHaveLength(a.length)
    const originalRows = [...new Set(a.map((d) => d.y))].sort((left, right) => left - right)
    const shiftedRows = [...new Set(b.map((d) => d.y))].sort((left, right) => left - right)
    expect(shiftedRows).toEqual([originalRows[0]! + 13, originalRows[1]!])
  })

  it('полкодержательдің цех офсеті кесілген бүйірден тыс шықса генерация тоқтайды', () => {
    expect(() => panelsFor('wardrobe-penal-600', { shelfPinFrontOffset: 1000 }))
      .toThrow(/shelfPinFrontOffset/)
    expect(() => panelsFor('wardrobe-penal-600', { shelfPinBackOffset: 1000 }))
      .toThrow(/shelfPinBackOffset/)
  })

  it('конфирматтың бет диаметрі мен торц пилоты профильден шығады', () => {
    const custom = panelsFor('wardrobe-penal-600', {
      confirmatFaceDiameter: 7, confirmatEdgeDepth: 30,
    }).flatMap((panel) => panel.drilling)
    expect(custom.some((d) => d.purpose === 'confirmat' && d.face === 'outer' && d.diameter === 7)).toBe(true)
    expect(custom.some((d) => d.purpose === 'confirmat' && d.face.startsWith('edge') && d.depth === 30)).toBe(true)
    expect(() => panelsFor('wardrobe-penal-600', { confirmatFaceDiameter: 4000 }))
      .toThrow(/confirmatFaceDiameter/)
  })

  it('screw чашкасы бекіту пилотын қосады, cup-only қоспайды', () => {
    const base = panelsFor('wardrobe-penal-600').filter((p) => p.role === 'front')
    expect(() => panelsFor('wardrobe-penal-600', { hingeCupMount: 'screw', hingeScrewPilotDepth: 8 }))
      .toThrow(/hingeScrewPilotDiameter/)
    expect(() => panelsFor('wardrobe-penal-600', { hingeCupMount: 'screw', hingeScrewPilotDiameter: 2.8 }))
      .toThrow(/hingeScrewPilotDepth/)
    expect(() => panelsFor('wardrobe-penal-600', { hingeCupMount: 'screw', hingeScrewPilotDiameter: 2.8, hingeScrewPilotDepth: 100 }))
      .toThrow(/hingeScrewPilotDepth/)
    expect(() => panelsFor('wardrobe-penal-600', {
      hingeCupMount: 'screw', hingeScrewPilotDiameter: 2.8, hingeScrewPilotDepth: 8, hingeFixingSpacing: 4000,
    })).toThrow(/hingeFixingSpacing/)
    expect(() => panelsFor('wardrobe-penal-600', {
      hingeCupMount: 'screw', hingeScrewPilotDiameter: 2.8, hingeScrewPilotDepth: 8, hingeFixingOffset: 4000,
    })).toThrow(/hingeFixingOffset/)
    // Ø2.8 — осы тестке цех өзі енгізген мысал; Blum cup стандарты емес.
    const screw = panelsFor('wardrobe-penal-600', { hingeCupMount: 'screw', hingeScrewPilotDiameter: 2.8, hingeScrewPilotDepth: 8 })
      .filter((p) => p.role === 'front')
    expect(screw[0]!.drilling.filter((d) => d.purpose === 'hinge').length)
      .toBe(base[0]!.drilling.filter((d) => d.purpose === 'hinge').length * 3)
    const pilots = screw[0]!.drilling.filter((d) => d.purpose === 'hinge' && d.diameter === 2.8)
    expect(pilots.length).toBeGreaterThan(0)
    expect(pilots.some((d) => !Number.isInteger(d.x))).toBe(true)
    const firstCup = base[0]!.drilling.find((d) => d.purpose === 'hinge' && d.diameter === 35)!
    const firstPair = pilots.filter((d) => Math.abs(d.x - firstCup.x) === 22.5)
    expect(firstPair).toHaveLength(2)
    expect(Math.abs(firstPair[1]!.x - firstPair[0]!.x)).toBe(45)
    expect(Math.abs(firstPair[0]!.y - firstCup.y)).toBe(9.5)
  })

  it('press-fit чашкасының нақты тереңдігі берілмесе генерация тоқтайды', () => {
    expect(() => panelsFor('wardrobe-penal-600', { hingeCupMount: 'press-fit' })).toThrow(/hingePressFitDepth/)
    expect(() => panelsFor('wardrobe-penal-600', { hingeCupMount: 'press-fit', hingePressFitDepth: 100 }))
      .toThrow(/hingePressFitDepth/)
    const panels = panelsFor('wardrobe-penal-600', { hingeCupMount: 'press-fit', hingePressFitDepth: 12 })
    expect(panels.flatMap((p) => p.drilling).some((d) => d.purpose === 'hinge' && d.diameter === 8 && d.depth === 12)).toBe(true)
  })

  it('минификс штифті sleeve-8 болса бетіндегі диаметр Ø8', () => {
    expect(() => panelsFor('kitchen-base-drawers-600', { minifixBoltMount: 'sleeve-8' })).toThrow()
    expect(() => panelsFor('kitchen-base-drawers-600', { minifixBoltMount: 'sleeve-8', minifixSleeveDepth: 100 }))
      .toThrow(/minifixSleeveDepth/)
    const panels = panelsFor('kitchen-base-drawers-600', { minifixBoltMount: 'sleeve-8', minifixSleeveDepth: 12 })
    expect(panels.flatMap((p) => p.drilling).some((d) =>
      d.purpose === 'minifix' && d.face === 'inner' && d.diameter === 8)).toBe(true)
  })

  it('анықталмаған стандарттардың әдепкісі бұрынғы физикалық мәндерді сақтайды', () => {
    expect(DEFAULT_SETTINGS.legCentreFromFront).toBe(104)
    expect(DEFAULT_SETTINGS.drawerFacadeScrewEndOffset).toBe(80)
    expect(DEFAULT_SETTINGS.minifixPairSpacing).toBe(32)
    expect(DEFAULT_SETTINGS.runnerRollerVerticalOffset).toBe(0)
    expect(DEFAULT_SETTINGS.hingeScrewPilotDepth).toBeNull()
    expect(DEFAULT_SETTINGS.hingeScrewPilotDiameter).toBeNull()
  })
})

describe('outer бетін операторға шығару', () => {
  it('ұзындық өсінде y, ен өсінде x айнадай аударылады, ал панель дерегі өзгермейді', async () => {
    const { pointOnMachinedFace } = await import('../src/core/faceCoordinates')
    const panel = panelsFor('wardrobe-penal-600').find((p) => p.id === 'side-left')!
    const hole = { face: 'outer' as const, x: 123, y: 47, diameter: 5, depth: 8, purpose: 'handle' as const }
    expect(pointOnMachinedFace(panel, hole, 'length')).toEqual({ x: 123, y: panel.cutWidth - 47 })
    expect(pointOnMachinedFace(panel, hole, 'width')).toEqual({ x: panel.cutLength - 123, y: 47 })
    expect(hole).toEqual({ face: 'outer', x: 123, y: 47, diameter: 5, depth: 8, purpose: 'handle' })
  })

  it('CNC-де outer беттің X/Y саны таңдалған өс бойынша ауысады', async () => {
    const { cncPanelCsv } = await import('../src/core/export/cnc')
    const panel = panelsFor('wardrobe-penal-600').find((p) => p.id === 'side-left')!
    const custom = { ...panel, drilling: [
      { face: 'outer' as const, x: 123, y: 47, diameter: 5, depth: 8, purpose: 'handle' as const },
    ] }
    const csv = cncPanelCsv(custom, catalog, { projectName: 'test', outerFlipAxis: 'length' })
    const fields = csv.replace('\ufeff', '').trim().split('\r\n')[1]!.split(';')
    expect(fields[8]).toBe('123')
    expect(fields[9]).toBe(String(panel.cutWidth - 47))
  })
})

describe('DXF outer экспорты', () => {
  it('CNC сияқты аудару өсін қолданып, асимметриялық тесікті аударады', async () => {
    const { panelToDxf } = await import('../src/core/export/dxf')
    const panel = panelsFor('wardrobe-penal-600').find((p) => p.id === 'side-left')!
    const custom = { ...panel, drilling: [
      { face: 'outer' as const, x: 123, y: 47, diameter: 5, depth: 8, purpose: 'handle' as const },
    ] }
    const dxf = panelToDxf(custom, { face: 'outer', settings: { ...DEFAULT_SETTINGS, outerFlipAxis: 'width' } })
    expect(dxf).toContain(`8\nDRILL_OUTER_5_D8\n10\n${panel.cutLength - 123}.0\n20\n47.0`)
  })
})

describe('аяқтың присадкасы мен 3D орны', () => {
  it('алдыңғы шегініс өзгерсе, аяқ пен бұранда бірге жылжиды', async () => {
    const { generateHardware } = await import('../src/core/hardware')
    const template = SEED_TEMPLATES.find((t) => t.id === 'kitchen-base-drawers-600')!
    const config = { ...templateToCabinet(template, catalog), base: { kind: 'legs' as const, height: 100 } }
    const oldHardware = generateHardware(config, catalog, shop.settings).filter((item) => item.kind === 'leg')
    const nextHardware = generateHardware(config, catalog, { legCentreFromFront: 120 }).filter((item) => item.kind === 'leg')
    expect(nextHardware.length).toBe(oldHardware.length)
    expect(nextHardware[0]!.position.z - oldHardware[0]!.position.z).toBe(16)
    const oldDrills = generateCabinet(config, catalog, shop.settings).flatMap((p) => p.drilling).filter((d) => d.purpose === 'leg')
    const nextDrills = generateCabinet(config, catalog, { legCentreFromFront: 120 }).flatMap((p) => p.drilling).filter((d) => d.purpose === 'leg')
    expect(nextDrills[0]!.y - oldDrills[0]!.y).toBe(16)
    expect(() => generateCabinet(config, catalog, { legCentreFromFront: 1000 }))
      .toThrow(/legCentreFromFront/)
    expect(() => generateCabinet(config, catalog, { legCentreFromFront: 0 }))
      .toThrow(/legCentreFromFront/)
  })
})

describe('конфирмат зенковкасының дерек шегі', () => {
  it('конус тереңдігі/бұрышы жоқ setting-ті үнсіз CNC тесігіне айналдырмайды', () => {
    expect(() => panelsFor('wardrobe-penal-600', { confirmatCountersinkDiameter: 10 }))
      .toThrow(/confirmatCountersinkDiameter/)
  })
})

describe('артикулға тәуелді drill орындары', () => {
  it('ролик направляющасының саны мен тік орны баптаудан шығады', () => {
    const template = SEED_TEMPLATES.find((t) => t.id === 'kitchen-base-drawers-600')!
    const config = { ...templateToCabinet(template, catalog), drawerSystem: 'roller' as const }
    const original = generateCabinet(config, catalog).find((p) => p.id === 'side-left')!.drilling.filter((d) => d.purpose === 'runner')
    const modified = generateCabinet(config, catalog, {
      runnerRollerHoleOffsets: [40, 120], runnerRollerVerticalOffset: 20,
    }).find((p) => p.id === 'side-left')!.drilling.filter((d) => d.purpose === 'runner')
    expect(modified.length).toBe(original.length * 2)
    expect(modified[0]!.x - original[0]!.x).toBe(20)
    expect(modified[0]!.y - original[0]!.y).toBe(3)
    expect(modified[1]!.y - modified[0]!.y).toBe(80)
    expect(() => generateCabinet(config, catalog, { runnerRollerVerticalOffset: 4000 }))
      .toThrow(/runnerRollerVerticalOffset/)
    expect(() => generateCabinet(config, catalog, { runnerRollerHoleOffsets: [1000] }))
      .toThrow(/runnerRollerHoleOffsets/)
  })

  it('ящик фасадының бұрандасы 80-нен 90 мм-ге жылжиды', () => {
    const first = panelsFor('kitchen-base-drawers-600').find((p) => p.id.includes('drawer-1-wall-front'))!
    const next = panelsFor('kitchen-base-drawers-600', { drawerFacadeScrewEndOffset: 90 })
      .find((p) => p.id === first.id)!
    const a = first.drilling.filter((d) => d.purpose === 'facadeScrew')
    const b = next.drilling.filter((d) => d.purpose === 'facadeScrew')
    expect(b).toHaveLength(a.length)
    expect(b[0]!.y - a[0]!.y).toBe(10)
  })

  it('минификстің екі штифті буын шеттерінен бірдей шегінеді', () => {
    const first = panelsFor('kitchen-base-drawers-600').find((p) => p.id.includes('drawer-1-wall-front'))!
    const next = panelsFor('kitchen-base-drawers-600', {
      minifixPairPlacement: 'ends', minifixPairEndOffset: 20,
    }).find((p) => p.id === first.id)!
    const a = first.drilling.filter((d) => d.purpose === 'minifix' && d.diameter === 15)
    const b = next.drilling.filter((d) => d.purpose === 'minifix' && d.diameter === 15)
    expect(b).toHaveLength(a.length)
    expect(new Set(b.map((d) => d.x)).size).toBe(2)
    expect(b[0]!.x).toBe(20)
    expect(b[1]!.x).toBe(first.finishedLength - 20)
    expect(() => panelsFor('kitchen-base-drawers-600', { minifixPairSpacing: 4000 }))
      .toThrow(/minifixPairSpacing/)
    expect(() => panelsFor('kitchen-base-drawers-600', { minifixPairPlacement: 'ends', minifixPairEndOffset: 4000 }))
      .toThrow(/minifixPairEndOffset/)
  })
})

describe('DXF-де күрделі контурдың outer қауіпсіздігі', () => {
  it('асимметриялық ойма мен outer drill әр беттің бөлек контур кадрында қалады', async () => {
    const { panelToDxf } = await import('../src/core/export/dxf')
    const panel = panelsFor('wardrobe-penal-600').find((p) => p.id === 'side-left')!
    const custom = { ...panel,
      drilling: [{ face: 'outer' as const, x: 123, y: 47, diameter: 5, depth: 8, purpose: 'handle' as const }],
      cutouts: [{ shape: 'circle' as const, id: 'sink', corner: 'bottomLeft' as const, x: 50, y: 80, diameter: 20 }],
    }
    const dxf = panelToDxf(custom, { catalog, settings: { ...DEFAULT_SETTINGS, outerFlipAxis: 'length' } })
    const origin = dxf.match(/0\nCIRCLE\n8\nCUTOUT\n10\n([\d.]+)\n20\n([\d.]+)/)
    const flipped = dxf.match(/0\nCIRCLE\n8\nCUTOUT_OUTER_REFERENCE\n10\n([\d.]+)\n20\n([\d.]+)/)
    expect(origin).not.toBeNull()
    expect(flipped).not.toBeNull()
    expect(Number(flipped![1])).toBe(Number(origin![1]))
    expect(Number(flipped![2]) + Number(origin![2])).toBe(panel.cutWidth)
    expect(dxf).toContain('OUTLINE_OUTER_REFERENCE')
  })

  it('трапецияның outer контуры тесігімен бірге айнаға түседі', async () => {
    const { panelToDxf } = await import('../src/core/export/dxf')
    const panel = panelsFor('wardrobe-mansard-1200').find((p) => p.id === 'side-left')!
    const dxf = panelToDxf(panel, { settings: { ...DEFAULT_SETTINGS, outerFlipAxis: 'length' } })
    const polyline = (layer: string) => {
      const chunk = dxf.split('0\nLWPOLYLINE\n').find((part) => part.startsWith(`8\n${layer}\n`))!
      const coordinateSection = chunk.split('\n0\n')[0]!
      const xs = [...coordinateSection.matchAll(/10\n([\d.]+)/g)].map((match) => Number(match[1]))
      const ys = [...coordinateSection.matchAll(/20\n([\d.]+)/g)].map((match) => Number(match[1]))
      return xs.map((x, index) => [x, ys[index]])
    }
    const inner = polyline('OUTLINE')
    const outer = polyline('OUTLINE_OUTER_REFERENCE')
    expect(inner.length).toBe(4)
    expect(outer).toEqual(inner.map(([x, y]) => [x, panel.cutWidth - y!]))
  })

  it('дөңгелек бұрыштың ARC бұрышы outer айнада кері бағытқа ауысады', async () => {
    const { panelToDxf } = await import('../src/core/export/dxf')
    const panel = panelsFor('wardrobe-penal-600').find((p) => p.id === 'side-left')!
    const custom = { ...panel,
      corners: { bottomLeft: 10, bottomRight: 0, topRight: 0, topLeft: 0 },
      drilling: [{ face: 'outer' as const, x: 123, y: 47, diameter: 5, depth: 8, purpose: 'handle' as const }],
    }
    const dxf = panelToDxf(custom, { settings: { ...DEFAULT_SETTINGS, outerFlipAxis: 'length' } })
    expect(dxf).toContain(`0\nARC\n8\nOUTLINE_OUTER_REFERENCE\n10\n10.0\n20\n${panel.cutWidth - 10}.0\n30\n0.0\n40\n10.0\n50\n90.0\n51\n180.0`)
  })
})
