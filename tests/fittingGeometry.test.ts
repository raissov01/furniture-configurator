import { describe, expect, it } from 'vitest'
import { mergeSettings } from '../src/core/constants'
import type { Drill, Panel } from '../src/core/types'
import { catalog, referenceWardrobe } from './fixtures'
import { generateCabinet } from '../src/core/generateCabinet'
import { fittingsForPanel } from '../lib/fittingGeometry'

const bands = new Map(catalog.edgeBands.map((band) => [band.id, band]))
const panel = generateCabinet(referenceWardrobe, catalog).find((part) => part.id === 's1-front-1')!
const thickness = catalog.materials.find((material) => material.id === panel.materialId)!.thickness
const drill = (purpose: Drill['purpose'], face: Drill['face'] = 'outer'): Drill => ({
  face, x: 40, y: 50, diameter: 8, depth: 12, purpose,
})

describe('fittingsForPanel', () => {
  it('әр присадка операциясын дәл бір көрініспен береді, ешбір purpose жоғалмайды', () => {
    const purposes: Drill['purpose'][] = [
      'confirmat', 'dowel', 'minifix', 'shelfPin', 'hinge', 'runner', 'handle', 'leg', 'facadeScrew',
    ]
    const source: Panel = { ...panel, drilling: purposes.map((purpose) => drill(purpose)) }
    const fittings = fittingsForPanel(source, thickness, bands, mergeSettings())
    expect(fittings).toHaveLength(source.drilling.length)
    expect(fittings.map((item) => item.purpose)).toEqual(purposes)
    expect(fittings.every((item) => item.name.length > 0 && item.article.length > 0)).toBe(true)
  })

  it('сыртқы нормаль тесіктің ішке кіретін бағытына қарсы және кромка координатасы сақталады', () => {
    const source: Panel = { ...panel, drilling: [drill('hinge', 'inner'), drill('dowel', 'edgeW1')] }
    const [hinge, dowel] = fittingsForPanel(source, thickness, bands, mergeSettings())
    expect(hinge!.normal).toEqual({ x: 0, y: 0, z: 1 })
    expect(dowel!.normal).toEqual({ x: -1, y: 0, z: 0 })
    expect(hinge!.point.x).toBe(42) // фасадтың W1 кромкасы 2 мм
    expect(dowel!.point.y).toBe(42) // edgeW1 x ен бойымен, L1 кромкасы 2 мм
  })

  it('конфирмат ұзындығы shop settings-тен, артикулы Drill-дан алынады', () => {
    const source: Panel = { ...panel, drilling: [{ ...drill('confirmat'), hardwareId: 'confirmat-7x70' }] }
    const fitting = fittingsForPanel(source, thickness, bands, mergeSettings({ confirmatScrewLength: 70 }))[0]!
    expect(fitting.length).toBe(70)
    expect(fitting.article).toBe('confirmat-7x70')
  })

  it('шкафта бұрыннан салынатын тұтқа мен аяқ үлгісін drill таңбасымен көбейтпейді', () => {
    const source: Panel = { ...panel, drilling: [
      drill('handle'), drill('handle'), drill('leg'), drill('leg'), drill('leg'), drill('leg'),
      drill('runner'),
    ] }
    const fittings = fittingsForPanel(source, thickness, bands, mergeSettings(), [source])
    expect(fittings.map((item) => item.purpose)).toEqual(['runner'])
  })

  it('артикулы жоқ конфирматта бапталған өлшемді көрсетеді', () => {
    const source: Panel = { ...panel, drilling: [drill('confirmat')] }
    expect(fittingsForPanel(source, thickness, bands, mergeSettings({ confirmatScrewLength: 50 }))[0]!.article)
      .toBe('confirmat-7x50')
    expect(fittingsForPanel(source, thickness, bands, mergeSettings({ confirmatScrewLength: 70 }))[0]!.article)
      .toBe('Артикул не задан')
  })

  it('эталон шкафта тек нақты бекіткіштерді көрсетеді: pilot емес, сөре торының орта тесігі', () => {
    const parts = generateCabinet(referenceWardrobe, catalog)
    const visuals = parts.flatMap((part) => fittingsForPanel(
      part, catalog.materials.find((material) => material.id === part.materialId)!.thickness,
      bands, mergeSettings(), parts,
    ))
    const count = (purpose: Drill['purpose']) => visuals.filter((item) => item.purpose === purpose).length
    expect(count('confirmat')).toBe(12) // 24 face+edge операциясы → 12 бұранда
    expect(count('shelfPin')).toBe(16) // 4 сөре × 2 бүйір × 2 қатар
    expect(count('hinge')).toBe(8) // 8 чашка; монтаж pilot-тары бөлек фурнитура емес
  })

  it('басқа секциядағы сөре бүйір панельге жалған ұстағыш қоспайды', () => {
    const parts = generateCabinet(referenceWardrobe, catalog)
    const side = parts.find((part) => part.id === 'side-left')!
    const shelf = parts.find((part) => part.role === 'shelf')!
    const firstPin = side.drilling.find((hole) => hole.purpose === 'shelfPin')!
    const remoteShelf: Panel = { ...shelf, id: 'remote-shelf', position: {
      ...shelf.position, x: 2000, y: side.position.y + firstPin.x,
    } }
    const fittings = fittingsForPanel(side, 16, bands, mergeSettings(), [...parts, remoteShelf])
    expect(fittings.filter((item) => item.purpose === 'shelfPin')).toHaveLength(8)
  })
})
