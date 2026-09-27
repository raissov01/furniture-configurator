import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { emptySurvey, updateMeasure, updateObstacle } from '../components/mobile/measurementModel'
import { configuratorKitchenTarget, handoffMeasurementToKitchen } from '../components/mobile/kitchenHandoff'
import { OBSTACLE_KINDS, toRoom } from '../src/core/measure'
import type { ProjectFileV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { IndexedDbMobileStore } from '../lib/mobile/indexedDb'

function completeSurvey() {
  let survey = updateMeasure(emptySurvey('survey-kitchen-1', 1000), 'height', 2670, 'laser', 1001)
  for (const wall of ['north', 'south'] as const) survey = updateMeasure(survey, `walls.${wall}.length`, 3100, 'manual', 1001)
  for (const wall of ['east', 'west'] as const) survey = updateMeasure(survey, `walls.${wall}.length`, 2200, 'manual', 1001)
  for (const corner of ['northWest', 'northEast', 'southEast', 'southWest'] as const) survey = updateMeasure(survey, `corners.${corner}`, 90, 'manual', 1001)
  for (const wall of ['north', 'east', 'south', 'west'] as const) {
    for (const kind of OBSTACLE_KINDS) survey = updateObstacle(survey, wall, kind, { status: 'absent', photoRef: `photo:${wall}:${kind}` })
  }
  return survey
}

describe('measured kitchen handoff', () => {
  it('passes the measured room and links the saved project to its source survey ID', async () => {
    const survey = completeSurvey()
    const loaded: unknown[] = []
    const saved: unknown[] = []
    const project = { schemaVersion: 4 } as ProjectFileV4
    await handoffMeasurementToKitchen(survey, {
      loadKitchen: (options, room) => loaded.push({ options, room }),
      exportProject: () => project,
      saveLocally: () => null,
      putProject: async (id, value) => { saved.push({ id, value }) },
    })
    expect(loaded).toEqual([{ options: { layout: 'straight', lengthA: 3100 },
      room: { width: 3100, depth: 2200, height: 2670, openings: [] } }])
    expect(saved).toEqual([{ id: 'survey-kitchen-1', value: project }])
  })
  it('таңдалған кез келген қабырғадан ас үй қатарын құрады', async () => {
    const loaded: unknown[] = []
    await handoffMeasurementToKitchen(completeSurvey(), {
      loadKitchen: (options) => loaded.push(options),
      exportProject: () => ({ schemaVersion: 4 }) as ProjectFileV4,
      saveLocally: () => null,
      putProject: async () => undefined,
    }, ['east'])
    expect(loaded).toEqual([{ layout: 'straight', lengthA: 2200 }])
  })
  it('шығыс қабырға таңдалса генератор модульдерін сол қабырғаға орналастырады', async () => {
    const before = useConfigurator.getState()
    try {
      await handoffMeasurementToKitchen(completeSurvey(), {
        loadKitchen: (options, room) => useConfigurator.getState().loadKitchen(options, room),
        placeOnWall: (wall) => {
          for (const placement of useConfigurator.getState().placements) {
            useConfigurator.getState().movePlacement(placement.cabinetId, { wall })
          }
        },
        exportProject: () => useConfigurator.getState().exportProject(),
        saveLocally: () => null,
        putProject: async () => undefined,
      }, ['east'])
      expect(useConfigurator.getState().placements.length).toBeGreaterThan(0)
      expect(useConfigurator.getState().placements.every((placement) => placement.wall === 'east')).toBe(true)
    } finally { useConfigurator.setState(before) }
  })

  it('stores measured H, W and D in the generated project room', () => {
    const before = useConfigurator.getState()
    try {
      before.loadKitchen({ layout: 'straight', lengthA: 3100 }, toRoom(completeSurvey()))
      expect(useConfigurator.getState().room).toMatchObject({ width: 3100, depth: 2200, height: 2670 })
      expect(useConfigurator.getState().exportProject().room).toMatchObject({ width: 3100, depth: 2200, height: 2670 })
      expect(useConfigurator.getState().room.openings).toEqual([])
      expect(useConfigurator.getState().exportProject().room.openings).toEqual([])
    } finally {
      useConfigurator.setState(before)
    }
  })

  it('persists the generated project under the survey ID in IndexedDB', async () => {
    const before = useConfigurator.getState()
    const db = await IndexedDbMobileStore.open('measured-kitchen-handoff', new IDBFactory())
    try {
      const survey = completeSurvey()
      await handoffMeasurementToKitchen(survey, {
        loadKitchen: (options, room) => useConfigurator.getState().loadKitchen(options, room),
        exportProject: () => useConfigurator.getState().exportProject(),
        saveLocally: () => null,
        putProject: (id, project) => db.putProject(id, project),
      })
      expect((await db.getProject(survey.id))?.room).toMatchObject({ width: 3100, depth: 2200, height: 2670 })
      expect((await db.getProject(survey.id))?.room.openings).toEqual([])
    } finally {
      db.close()
      useConfigurator.setState(before)
    }
  })

  it('refuses a skewed room before invoking the generator', async () => {
    const survey = completeSurvey()
    survey.corners.northEast.value = 89
    let invoked = false
    await expect(handoffMeasurementToKitchen(survey, {
      loadKitchen: () => { invoked = true },
      exportProject: () => ({ schemaVersion: 4 }) as ProjectFileV4,
      saveLocally: () => { invoked = true; return null },
      putProject: async () => { invoked = true },
    })).rejects.toThrow(/corner|бұрыш/i)
    expect(invoked).toBe(false)
  })

  it('конфигуратор ашылғанда өлшенген ас үйді ескі автосақтаумен баспайды', async () => {
    const before = useConfigurator.getState()
    const db = await IndexedDbMobileStore.open('measured-kitchen-autosave', new IDBFactory())
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => { values.set(name, value) },
      removeItem: (name: string) => { values.delete(name) },
    } })
    try {
      // Телефонда бұрын ашылған басқа жоба автосақтауда тұр.
      useConfigurator.getState().saveProjectLocally()
      expect(values.size).toBeGreaterThan(0)
      const survey = completeSurvey()
      await handoffMeasurementToKitchen(survey, configuratorKitchenTarget((id, project) => db.putProject(id, project)))
      // /configurator ашылғанда Workspace hydrateProject() шақырады.
      useConfigurator.getState().hydrateProject()
      expect(useConfigurator.getState().room).toMatchObject({ width: 3100, depth: 2200, height: 2670 })
      expect(useConfigurator.getState().cabinets.length).toBeGreaterThan(0)
      // Бұрынғы жоба жойылмайды: Ctrl+Z оны қайтарады.
      useConfigurator.getState().undo()
      expect(useConfigurator.getState().room.width).toBe(4000)
    } finally {
      vi.unstubAllGlobals()
      db.close()
      useConfigurator.setState(before)
    }
  })

  it('бүлінген автосақтауды өлшенген ас үймен сақтық көшірмесіз баспайды', async () => {
    const before = useConfigurator.getState()
    const key = 'furniture-configurator:project'
    const values = new Map<string, string>([[key, '{бүлінген']])
    vi.stubGlobal('window', { localStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => { values.set(name, value) },
      removeItem: (name: string) => { values.delete(name) },
    } })
    try {
      await expect(handoffMeasurementToKitchen(completeSurvey(), configuratorKitchenTarget(async () => {})))
        .rejects.toThrow()
      expect(values.get(key)).toBe('{бүлінген')
    } finally {
      vi.unstubAllGlobals()
      useConfigurator.setState(before)
    }
  })
})
