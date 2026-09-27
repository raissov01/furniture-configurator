/**
 * Присадканы қолмен түзету.
 *
 * Ең маңызды екі ереже:
 *   1. Түзету КОНФИГТЕ тұрады, панельде емес — панель әрқашан қайта есептеледі.
 *   2. Түзетілген присадканы БӘРІ көреді: 3D те, DXF те, сметадағы фурнитура да.
 *      Егер біреуі ескі тесіктерді көрсе, цехқа қате қағаз кетеді.
 */
import { describe, expect, it } from 'vitest'
import {
  DRILL_PRESETS,
  SEED_CATALOG,
  addDrill,
  cabinetToDxfFiles,
  cncPanelCsv,
  drillEditCounts,
  drillFromPreset,
  drillKey,
  findDrillPreset,
  findTemplate,
  generateCabinet,
  isManualDrill,
  parseProject,
  removeDrill,
  resetPanelDrills,
  snapToPitch,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Drill, DrillEdits, Panel } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)
const build = (config: CabinetConfig): Panel[] => generateCabinet(config, SEED_CATALOG)

const sideOf = (panels: Panel[]): Panel => panels.find((p) => p.id.startsWith('side'))!

describe('түзетуді жабу', () => {
  it('түзетусіз присадка сол күйінде қалады', () => {
    const panels = build(base())
    const withEmpty = build({ ...base(), drillEdits: {} })
    expect(withEmpty.map((p) => p.drilling)).toEqual(panels.map((p) => p.drilling))
  })

  it('шетке сыймаған қол Ø35 тесік панельге де, станок CSV-іне де өтпейді', () => {
    const config = base()
    const front = build(config).find((panel) => panel.label === 'Фасад')!
    const hole = drillFromPreset(findDrillPreset('hinge-cup')!, 'inner', 0, 160, 16)
    expect(() => build({ ...config, drillEdits: addDrill({}, front.id, hole) }))
      .toThrow(/drillEdits.*position/)
    expect(() => cncPanelCsv({ ...front, drilling: [...front.drilling, hole] }, SEED_CATALOG,
      { projectName: 'Тест' })).toThrow(/drilling.*position/)
  })

  it('қосылған тесік панельге түседі әрі ҚОЛМЕН деп танылады', () => {
    const config = base()
    const side = sideOf(build(config))
    const preset = findDrillPreset('shelf-pin')!
    const drill = drillFromPreset(preset, 'inner', 100, 37, 16)

    const edits: DrillEdits = addDrill({}, side.id, drill)
    const panels = build({ ...config, drillEdits: edits })
    const edited = panels.find((p) => p.id === side.id)!

    expect(edited.drilling).toHaveLength(side.drilling.length + 1)
    const added = edited.drilling.find((d) => drillKey(d) === drillKey(drill))!
    expect(added).toMatchObject({ face: 'inner', x: 100, y: 37, diameter: 5, depth: 8, purpose: 'shelfPin' })
    expect(isManualDrill(added, edits[side.id])).toBe(true)
    // Автоматты тесік «қолмен» болып саналмайды.
    const auto = edited.drilling.find((d) => drillKey(d) !== drillKey(drill))!
    expect(isManualDrill(auto, edits[side.id])).toBe(false)
  })

  it('өшірілген АВТО тесік қайта есептегенде де жоқ болады', () => {
    const config = base()
    const side = sideOf(build(config))
    const victim = side.drilling[0]!

    const edits = removeDrill({}, side.id, victim, { manual: false })
    const twice = [build({ ...config, drillEdits: edits }), build({ ...config, drillEdits: edits })]
    for (const panels of twice) {
      const edited = panels.find((p) => p.id === side.id)!
      expect(edited.drilling.some((d) => drillKey(d) === drillKey(victim))).toBe(false)
      expect(edited.drilling).toHaveLength(side.drilling.length - 1)
    }
  })

  it('конфиг ӨЗГЕРМЕЙДІ: панельдегі тесік конфигтегімен бір объект емес', () => {
    const config = base()
    const side = sideOf(build(config))
    const drill = drillFromPreset(findDrillPreset('confirmat-face')!, 'outer', 50, 50, 16)
    const edits = addDrill({}, side.id, drill)

    const panels = build({ ...config, drillEdits: edits })
    const added = panels.find((p) => p.id === side.id)!.drilling
      .find((d) => drillKey(d) === drillKey(drill))!
    added.x = 999

    expect(edits[side.id]!.added[0]!.x).toBe(50)
  })
})

describe('түзетуді өзгерту', () => {
  const panelId = 'side-left'
  const drill: Drill = { face: 'inner', x: 100, y: 37, diameter: 5, depth: 8, purpose: 'shelfPin' }

  it('бір тесік екі рет қосылмайды', () => {
    const once = addDrill({}, panelId, drill)
    expect(addDrill(once, panelId, { ...drill })).toBe(once)
    expect(once[panelId]!.added).toHaveLength(1)
  })

  it('қолмен қосылғанды өшіру тізімнен ЖОҒАЛТАДЫ, «өшірілген» деп белгілемейді', () => {
    const added = addDrill({}, panelId, drill)
    const after = removeDrill(added, panelId, drill, { manual: true })
    expect(after[panelId]).toBeUndefined()
  })

  it('өшірілген авто тесікті қайта қосу белгіні де алып тастайды', () => {
    const removed = removeDrill({}, panelId, drill, { manual: false })
    expect(removed[panelId]!.removed).toEqual([drillKey(drill)])

    const back = addDrill(removed, panelId, drill)
    expect(back[panelId]!.removed).toEqual([])
    expect(back[panelId]!.added).toHaveLength(1)
  })

  it('бос түзету сақталмайды — жоба файлында қоқыс жиналмайды', () => {
    const edits = removeDrill(addDrill({}, panelId, drill), panelId, drill, { manual: true })
    expect(Object.keys(edits)).toEqual([])
  })

  it('«авто күйіне қайтару» панельдің бүкіл түзетуін алады', () => {
    let edits = addDrill({}, panelId, drill)
    edits = removeDrill(edits, panelId, { ...drill, x: 200 }, { manual: false })
    edits = addDrill(edits, 'top', drill)

    const reset = resetPanelDrills(edits, panelId)
    expect(reset[panelId]).toBeUndefined()
    expect(reset['top']).toBeDefined()
    expect(drillEditCounts(reset)).toEqual({ added: 1, removed: 0 })
  })

  it('санақ қосылған мен өшірілгенді бөлек көрсетеді', () => {
    let edits = addDrill({}, panelId, drill)
    edits = removeDrill(edits, panelId, { ...drill, x: 300 }, { manual: false })
    expect(drillEditCounts(edits)).toEqual({ added: 1, removed: 1 })
    expect(drillEditCounts(undefined)).toEqual({ added: 0, removed: 0 })
  })
})

describe('пресеттер', () => {
  it('сандары §4.9 константаларымен БІР', () => {
    expect(findDrillPreset('confirmat-edge')).toMatchObject({ diameter: 5, depth: 35, where: 'edge' })
    expect(findDrillPreset('shelf-pin')).toMatchObject({ diameter: 5, depth: 8 })
    expect(findDrillPreset('hinge-cup')).toMatchObject({ diameter: 35, depth: 12.5 })
    expect(DRILL_PRESETS.every((p) => p.name.includes('Ø'))).toBe(true)
  })

  it('өтпелі тесіктің тереңдігі панельдің ҚАЛЫҢДЫҒЫНАН алынады', () => {
    const preset = findDrillPreset('confirmat-face')!
    expect(drillFromPreset(preset, 'outer', 10, 10, 16).depth).toBe(16)
    expect(drillFromPreset(preset, 'outer', 10, 10, 18).depth).toBe(18)
  })

  it('координата бүтін миллиметрге дөңгелектенеді', () => {
    const drill = drillFromPreset(findDrillPreset('shelf-pin')!, 'inner', 100.6, 36.4, 16)
    expect(drill.x).toBe(101)
    expect(drill.y).toBe(36)
  })

  it('32 мм торына түсіру', () => {
    expect(snapToPitch(100)).toBe(96)
    expect(snapToPitch(100, 32)).toBe(96)
    expect(snapToPitch(50, 32)).toBe(64)
  })
})

describe('түзетілген присадканы БӘРІ көреді', () => {
  const config = base()
  const side = sideOf(build(config))
  const drill = drillFromPreset(findDrillPreset('shelf-pin')!, 'inner', 123, 37, 16)
  const edited = build({ ...config, drillEdits: addDrill({}, side.id, drill) })

  it('DXF-те қосылған тесік бар', () => {
    const before = cabinetToDxfFiles(build(config)).get(`${side.id}.dxf`)!
    const after = cabinetToDxfFiles(edited).get(`${side.id}.dxf`)!
    const circles = (dxf: string) => dxf.split('CIRCLE').length - 1
    expect(circles(after)).toBe(circles(before) + 1)
  })

  it('жоба файлы түзетуді сақтайды әрі қайта оқиды', () => {
    const project = {
      schemaVersion: 3 as const,
      name: 'Тест',
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [{ ...config, drillEdits: addDrill({}, side.id, drill) }],
      room: { width: 3000, depth: 3000, height: 2700 },
      placements: [{ cabinetId: config.id, wall: 'north' as const, offset: 0 }],
    }
    const parsed = parseProject(JSON.parse(JSON.stringify(project)))
    expect(parsed.cabinets[0]!.drillEdits![side.id]!.added[0]).toMatchObject({ x: 123, y: 37 })
  })

  it('түзетуі жоқ ЕСКІ жоба сол күйінде оқылады', () => {
    const project = {
      schemaVersion: 3 as const,
      name: 'Ескі',
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [config],
      room: { width: 3000, depth: 3000, height: 2700 },
      placements: [{ cabinetId: config.id, wall: 'north' as const, offset: 0 }],
    }
    const parsed = parseProject(JSON.parse(JSON.stringify(project)))
    expect(parsed.cabinets[0]!.drillEdits).toBeUndefined()
  })
})
