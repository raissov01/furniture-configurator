/**
 * PRO100 дәлдігі v2: бөлме торы, «Свет» терезесі, «Отчёты» кестелері,
 * «Свойства помещения» өрістері және сахна стилін таңдау.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LIGHTING, lightingFactor, parseLighting, sceneLightIntensities } from '../lib/classicLighting'
import { materialRows, partRows, tableText } from '../lib/classicReports'
import { cameraInsideFace, gridLines, ROOM_GRID_STEP } from '../components/ClassicRoom'
import { roomDraftPatch } from '../components/ClassicRoomDialog'
import { classicSceneLook } from '../store/classicView'
import type { Material, Panel } from '../src/core/index'

describe('PRO100 бөлмесі', () => {
  it('бос бөлме — тор, отделка не «Реалистичный вид» — шынайы, классикалық емес — бұрынғы шынайы', () => {
    expect(classicSceneLook(true, false, false)).toBe('schematic')
    expect(classicSceneLook(true, true, false)).toBe('realistic')
    expect(classicSceneLook(true, false, true)).toBe('realistic')
    expect(classicSceneLook(false, false, false)).toBe('realistic')
  })

  it('тор сызықтары екі шетті де қамтиды, қадамы 500 мм', () => {
    const lines = gridLines(1200, 600, ROOM_GRID_STEP)
    // X: 0, 500, 1000, 1200 → 4 тік; Y: 0, 500, 600 → 3 көлденең; әр сызық 6 сан.
    expect(lines.length).toBe((4 + 3) * 6)
    expect(lines.slice(0, 6)).toEqual([0, 0, 0, 0, 600, 0])
    expect(lines.slice(18, 24)).toEqual([1200, 0, 0, 1200, 600, 0])
  })

  it('камера бөлменің сыртында тұрған қабырға салынбайды', () => {
    const north = { origin: { x: 4000, y: 0, z: 0 }, inward: { x: 0, y: 0, z: 1 } }
    expect(cameraInsideFace({ x: 2000, y: 1500, z: -3000 }, north)).toBe(false)
    expect(cameraInsideFace({ x: 2000, y: 1500, z: 1000 }, north)).toBe(true)
  })
})

describe('«Свет» терезесі', () => {
  it('бұзылған жазба әдепкіге құлайды, мәндер 0…100 аралығына қысылады', () => {
    expect(parseLighting('{nope')).toEqual(DEFAULT_LIGHTING)
    const parsed = parseLighting(JSON.stringify({ sun: { on: false, value: 250 }, camera: { on: true, value: 'x' } }))
    expect(parsed.sun).toEqual({ on: false, value: 100 })
    expect(parsed.camera).toEqual(DEFAULT_LIGHTING.camera)
  })

  it('«общее» өшсе, күн мен камера да өшеді; құсбелгісіз арна нөл', () => {
    const off = { ...DEFAULT_LIGHTING, general: { on: false, value: 100 } }
    const levels = sceneLightIntensities(off)
    expect(levels.sun).toBe(0)
    expect(levels.camera).toBe(0)
    expect(lightingFactor({ ...DEFAULT_LIGHTING, ao: { on: false, value: 80 } }, 'ao')).toBe(0)
    expect(sceneLightIntensities(DEFAULT_LIGHTING).sun).toBeCloseTo(1.5)
  })
})

describe('«Отчёты»', () => {
  const material = { id: 'ldsp16', name: 'ЛДСП 16', thickness: 16 } as Material
  const panel = (label: string, finishedLength: number, finishedWidth: number) =>
    ({ label, finishedLength, finishedWidth, materialId: 'ldsp16' }) as Panel

  it('бірдей детальдар бір жолға саналады, готовый өлшеммен', () => {
    const rows = partRows([{ name: 'Шкаф', panels: [panel('Боковина', 2000, 447), panel('Боковина', 2000, 447), panel('Полка', 566, 447)] }],
      [material], (label) => label, false)
    expect(rows).toEqual([
      { group: '', name: 'Боковина', length: 2000, width: 447, thickness: 16, count: 2, material: 'ЛДСП 16' },
      { group: '', name: 'Полка', length: 566, width: 447, thickness: 16, count: 1, material: 'ЛДСП 16' },
    ])
    expect(materialRows([{ name: 'Шкаф', panels: [panel('Боковина', 2000, 500)] }], [material]))
      .toEqual([{ material: 'ЛДСП 16', thickness: 16, parts: 1, areaM2: 1 }])
  })

  it('CSV ұяшығындағы нүктелі үтір мен тырнақша қорғалады', () => {
    expect(tableText(['A', 'B'], [['x;y', 'q"'], [1, 2]], ';')).toBe('A;B\n"x;y";"q"""\n1;2')
  })
})

describe('«Свойства помещения»', () => {
  const draft = { width: '4000', depth: '3000', height: '2700', floor: '' as const, wallColor: '' }
  it('бүтін мм-ді қабылдайды, отделкасыз бөлмені тор етіп қалдырады', () => {
    expect(roomDraftPatch(draft)).toEqual({ patch: { width: 4000, depth: 3000, height: 2700, finish: undefined }, error: null })
    expect(roomDraftPatch({ ...draft, floor: 'oak' }).patch.finish).toEqual({ floor: 'oak' })
  })
  it('жарамсыз өлшемді өріс атымен және рұқсат аралығымен қайтарады', () => {
    expect(roomDraftPatch({ ...draft, height: '1500' }).error).toBe('room.height: 2000..4000 мм')
    expect(roomDraftPatch({ ...draft, width: '12.5' }).error).toMatch(/^room\.width/)
  })
})

describe('классикалық жұмыс орны: түсініктілік', () => {
  const workspace = readFileSync(new URL('../components/Workspace.tsx', import.meta.url), 'utf8')
  it('әр жолақ құралы күй жолағына «не істейді» деп жазады', () => {
    const toolbar = workspace.slice(workspace.indexOf('const classicToolRows:'), workspace.indexOf('\n  return (', workspace.indexOf('const classicToolRows:')))
    const withIcon = (toolbar.match(/\{ icon: /g) ?? []).length
    const withHint = (toolbar.match(/hint: /g) ?? []).length
    expect(withHint / withIcon).toBeGreaterThan(0.85)
  })
  it('«Панели» тік қойындысы мен «Сервис» мәзірі классикада жоқ', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.p100-workspace details\.p100-dock-closed-tab \{ display: none; \}/)
    expect(readFileSync(new URL('../lib/classicMenu.ts', import.meta.url), 'utf8')).not.toContain("label: 'Сервис'")
  })
})

describe('Библиотека PRO100', () => {
  it('Н1/В1 — бір есік, Н2 — екі есік; өзге код есікті өзгертпейді', async () => {
    const { variantDoors } = await import('../components/ClassicLibraryDock')
    expect(variantDoors('Н1')).toBe(1)
    expect(variantDoors('В2')).toBe(2)
    expect(variantDoors('НВ2')).toBeUndefined()
    expect(variantDoors(undefined)).toBeUndefined()
  })
})
