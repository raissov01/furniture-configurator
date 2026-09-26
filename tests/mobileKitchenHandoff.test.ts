import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { emptySurvey, updateMeasure, updateObstacle } from '../components/mobile/measurementModel'
import { handoffMeasurementToKitchen } from '../components/mobile/kitchenHandoff'
import { OBSTACLE_KINDS } from '../src/core/measure'
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
      putProject: async (id, value) => { saved.push({ id, value }) },
    })
    expect(loaded).toEqual([{ options: { layout: 'straight', lengthA: 3100 },
      room: { width: 3100, depth: 2200, height: 2670 } }])
    expect(saved).toEqual([{ id: 'survey-kitchen-1', value: project }])
  })

  it('stores measured H, W and D in the generated project room', () => {
    const before = useConfigurator.getState()
    try {
      before.loadKitchen({ layout: 'straight', lengthA: 3100 }, { width: 3100, depth: 2200, height: 2670 })
      expect(useConfigurator.getState().room).toMatchObject({ width: 3100, depth: 2200, height: 2670 })
      expect(useConfigurator.getState().exportProject().room).toMatchObject({ width: 3100, depth: 2200, height: 2670 })
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
        putProject: (id, project) => db.putProject(id, project),
      })
      expect((await db.getProject(survey.id))?.room).toMatchObject({ width: 3100, depth: 2200, height: 2670 })
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
      putProject: async () => { invoked = true },
    })).rejects.toThrow(/corner|бұрыш/i)
    expect(invoked).toBe(false)
  })
})
