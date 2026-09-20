/**
 * СТРУКТУРА ПРОЕКТЫ докинг панелінің таза логикасы
 * (`components/panels/structureTree.ts`).
 */
import { describe, expect, it } from 'vitest'
import { findTemplate, templateToCabinet, SEED_CATALOG, ConfigValidationError } from '../src/core/index'
import type { CabinetConfig, Placement, Room } from '../src/core/index'
import { buildProjectScene, flatSceneToRows } from '../components/panels/structureTree'

const room: Room = { width: 4000, depth: 3000, height: 2700 }

const cab = (id: string, name?: string): CabinetConfig => ({
  ...templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG),
  id,
  ...(name ? { name } : {}),
})

describe('buildProjectScene', () => {
  it('орны бар корпустар ғана сахнаға түседі', () => {
    const placements: Placement[] = [{ cabinetId: 'c1', wall: 'south', offset: 0 }]
    const scene = buildProjectScene(room, [cab('c1'), cab('c2')], placements, SEED_CATALOG, 'Тест')
    expect(scene.nodes.map((n) => n.nodeId)).toEqual(['c1'])
  })

  it('жарамсыз корпус flattenTree-ден ConfigValidationError лақтырады (шақырушы ұстауы керек)', () => {
    const bad = { ...cab('c1'), width: -1 }
    const placements: Placement[] = [{ cabinetId: 'c1', wall: 'south', offset: 0 }]
    expect(() => buildProjectScene(room, [bad], placements, SEED_CATALOG, 'Тест')).toThrow(ConfigValidationError)
  })
})

describe('flatSceneToRows', () => {
  it('бір корпус — селект кілті шикі panel.id (mergeProjectPanels-пен бірдей ереже)', () => {
    const placements: Placement[] = [{ cabinetId: 'c1', wall: 'south', offset: 0 }]
    const scene = buildProjectScene(room, [cab('c1', 'Шкаф А')], placements, SEED_CATALOG, 'Тест')
    const rows = flatSceneToRows(scene)

    const cabinetRow = rows.find((r) => r.kind === 'cabinet')
    expect(cabinetRow).toBeDefined()
    expect(cabinetRow!.label).toBe('Шкаф А')
    expect((cabinetRow as { partCount: number }).partCount).toBe(scene.nodes[0]!.panels.length)

    const partRows = rows.filter((r) => r.kind === 'part')
    expect(partRows).toHaveLength(scene.nodes[0]!.panels.length)
    const firstPanel = scene.nodes[0]!.panels[0]!
    const firstRow = partRows.find((r) => r.kind === 'part' && r.selectId === firstPanel.id)
    expect(firstRow).toBeDefined()
  })

  it('екі корпус — селект кілті "cabinetId--panelId" болып префикстеледі', () => {
    const placements: Placement[] = [
      { cabinetId: 'c1', wall: 'south', offset: 0 },
      { cabinetId: 'c2', wall: 'south', offset: 700 },
    ]
    const scene = buildProjectScene(room, [cab('c1'), cab('c2')], placements, SEED_CATALOG, 'Тест')
    const rows = flatSceneToRows(scene)
    const partRows = rows.filter((r) => r.kind === 'part')
    expect(partRows.every((r) => r.kind === 'part' && r.selectId.startsWith(`${r.cabinetId}--`))).toBe(true)
  })

  it('жолдар реті: әр корпус жолынан кейін дәл сол корпустың детальдары келеді', () => {
    const placements: Placement[] = [
      { cabinetId: 'c1', wall: 'south', offset: 0 },
      { cabinetId: 'c2', wall: 'south', offset: 700 },
    ]
    const scene = buildProjectScene(room, [cab('c1'), cab('c2')], placements, SEED_CATALOG, 'Тест')
    const rows = flatSceneToRows(scene)

    let currentCabinet: string | null = null
    for (const row of rows) {
      if (row.kind === 'cabinet') {
        currentCabinet = row.cabinetId
      } else {
        expect(row.cabinetId).toBe(currentCabinet)
      }
    }
  })
})
