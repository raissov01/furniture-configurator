/**
 * Жеке детальдің қасиеттері: ТЕКСТУРА бағыты мен БҰРЫШТЫҢ радиусы.
 *
 * Екеуі де qdesign-нің панель редакторында бар. Айырмасы: текстура
 * РАСКРОЙҒА әсер етеді (текстуралы материалда деталь бұрылмайды), ал радиус
 * тек фрезаның жолын өзгертеді — раскрой бәрібір тікбұрыш кеседі.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, cabinetToDxfFiles, findTemplate, generateCabinet, nestPanels, parseProject,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)
const byId = (panels: Panel[], id: string) => panels.find((p) => p.id === id)!

describe('текстура бағыты', () => {
  it('әдепкіде материалдан алынады', () => {
    const panels = generateCabinet(base(), SEED_CATALOG)
    const side = byId(panels, 'side-left')
    const material = SEED_CATALOG.materials.find((m) => m.id === side.materialId)!
    expect(side.grainAlongLength).toBe(material.hasGrain)
  })

  it('жеке деталь КӨЛДЕНЕҢ қойылады', () => {
    const panels = generateCabinet(
      { ...base(), panelGrain: { 'side-left': 'width' } },
      SEED_CATALOG,
    )
    expect(byId(panels, 'side-left').grainAlongLength).toBe(false)
    // Көршісі тиылмайды.
    expect(byId(panels, 'side-right').grainAlongLength).toBe(true)
  })

  it('раскрой оны ЕСКЕРЕДІ: текстуралы материалда деталь бұрылмайды', () => {
    const along = generateCabinet(base(), SEED_CATALOG)
    const across = generateCabinet({ ...base(), panelGrain: { 'side-left': 'width' } }, SEED_CATALOG)

    const place = (panels: Panel[]) => {
      const nesting = nestPanels(panels, SEED_CATALOG)
      return nesting.byMaterial.flatMap((m) => m.sheets).flatMap((s) => s.parts)
        .find((p) => p.panelId === 'side-left')!
    }
    const a = place(along)
    const b = place(across)
    // Бағыт ауысқанда парақтағы өлшемі де ауысады (ұзыны мен ені алмасады).
    expect([b.width, b.height]).toEqual([a.height, a.width])
  })

  it('деталировкада бағыты жазылады', () => {
    const panels = generateCabinet({ ...base(), panelGrain: { 'side-left': 'width' } }, SEED_CATALOG)
    expect(byId(panels, 'side-left').grainAlongLength).toBe(false)
  })
})

describe('бұрыштарды дөңгелектеу', () => {
  const radii = { bottomLeft: 20, bottomRight: 20, topRight: 0, topLeft: 0 }
  const panels = generateCabinet({ ...base(), panelCorners: { top: radii } }, SEED_CATALOG)
  const top = byId(panels, 'top')

  it('панельге жазылады әрі ескертпеде көрінеді', () => {
    expect(top.corners).toEqual(radii)
    expect(top.note).toContain('R20')
  })

  it('барлығы нөл болса — тікбұрыш, ештеңе жазылмайды', () => {
    const plain = generateCabinet(
      { ...base(), panelCorners: { top: { bottomLeft: 0, bottomRight: 0, topRight: 0, topLeft: 0 } } },
      SEED_CATALOG,
    )
    expect(byId(plain, 'top').corners).toBeUndefined()
  })

  it('РАСКРОЙ өзгермейді — парақтан бәрібір тікбұрыш кесіледі', () => {
    const withR = nestPanels(panels, SEED_CATALOG)
    const without = nestPanels(generateCabinet(base(), SEED_CATALOG), SEED_CATALOG)
    expect(withR.sheetCount).toBe(without.sheetCount)
    expect(byId(panels, 'top').cutLength).toBe(byId(generateCabinet(base(), SEED_CATALOG), 'top').cutLength)
  })

  it('тым үлкен радиус — ҚАТЕ', () => {
    expect(() => generateCabinet(
      { ...base(), panelCorners: { top: { ...radii, bottomLeft: 5000 } } },
      SEED_CATALOG,
    )).toThrow(/0\.\./)
  })

  it('DXF-те контур доғамен салынады', () => {
    const dxf = cabinetToDxfFiles(panels).get('top.dxf')!
    expect(dxf).toContain('ARC')
    // Тікбұрышты детальде доға болмайды.
    const plain = cabinetToDxfFiles(generateCabinet(base(), SEED_CATALOG)).get('top.dxf')!
    expect(plain).not.toContain('ARC')
  })

  it('жоба файлында екеуі де сақталады', () => {
    const config = { ...base(), panelGrain: { 'side-left': 'width' as const }, panelCorners: { top: radii } }
    const project = {
      schemaVersion: 3 as const,
      name: 'Тест',
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [config],
      room: { width: 3000, depth: 3000, height: 2700 },
      placements: [{ cabinetId: config.id, wall: 'north' as const, offset: 0 }],
    }
    const parsed = parseProject(JSON.parse(JSON.stringify(project)))
    expect(parsed.cabinets[0]!.panelGrain).toEqual({ 'side-left': 'width' })
    expect(parsed.cabinets[0]!.panelCorners!['top']).toEqual(radii)
  })
})
