import { describe, expect, it } from 'vitest'
import { MemorySyncStore } from '../src/core/sync/memoryStore'
import { SyncQueue } from '../src/core/sync/queue'
import type { SyncStore } from '../src/core/sync/types'
import { emptySurvey, updateMeasure, updateObstacle } from '../components/mobile/measurementModel'
import { OBSTACLE_KINDS } from '../src/core/measure'
import { enqueueLatestMeasurement, keepLocalMeasurement, retryDelay } from '../components/mobile/measurementSync'

function validDraft(id: string) {
  let draft = updateMeasure(emptySurvey(id, 1000), 'height', 2600, 'manual', 1000)
  for (const wall of ['north', 'east', 'south', 'west'] as const) draft = updateMeasure(draft, `walls.${wall}.length`, 3000, 'manual', 1000)
  for (const corner of ['northWest', 'northEast', 'southEast', 'southWest'] as const) draft = updateMeasure(draft, `corners.${corner}`, 90, 'manual', 1000)
  for (const wall of ['north', 'east', 'south', 'west'] as const) {
    for (const kind of OBSTACLE_KINDS) draft = updateObstacle(draft, wall, kind, { status: 'absent', photoRef: `photo:${wall}:${kind}` })
  }
  return draft
}

describe('mobile measurement upload policy', () => {
  it('keeps one in-flight version and resends the newer local draft from acknowledged revision', async () => {
    const store = new MemorySyncStore()
    const sent: { id: string; baseVersion: number; height: number }[] = []
    const queue = new SyncQueue(store, { send: async (action) => {
      sent.push({ id: action.id, baseVersion: action.baseRevision.version,
        height: (action.payload as { height: { value: number } }).height.value })
      return { kind: 'applied', revision: { version: sent.length, updatedAt: 1000 + sent.length } }
    } })
    await queue.setOnline(false, 1000)
    const first = validDraft('m1')
    expect(await enqueueLatestMeasurement(first, store, queue, 1001, 'a1')).toBe('queued')
    const newer = updateMeasure(first, 'height', 2700, 'laser', 1002)
    expect(await enqueueLatestMeasurement(newer, store, queue, 1002, 'a2')).toBe('pending')
    expect((await store.list()).length).toBe(1)
    await queue.setOnline(true, 1003)
    expect(await enqueueLatestMeasurement(newer, store, queue, 1004, 'a3')).toBe('queued')
    expect(sent).toEqual([
      { id: 'a1', baseVersion: 0, height: 2600 },
      { id: 'a3', baseVersion: 1, height: 2700 },
    ])
    expect(await enqueueLatestMeasurement(newer, store, queue, 1005, 'a4')).toBe('unchanged')
  })

  it('does not retry rejected actions automatically on every reconnect', async () => {
    const store = new MemorySyncStore()
    const queue = new SyncQueue(store, { send: async () => ({ kind: 'rejected', reason: '401' }) })
    const survey = validDraft('m-rejected')
    await queue.setOnline(true, 1000)
    expect(await enqueueLatestMeasurement(survey, store, queue, 1001, 'a1')).toBe('queued')
    expect(await enqueueLatestMeasurement(survey, store, queue, 1002, 'a2')).toBe('rejected')
    expect((await store.list()).map((item) => item.status)).toEqual(['rejected'])
  })

  it('keeps a conflict unresolved if the replacement cannot be queued', async () => {
    const store = new MemorySyncStore()
    const survey = validDraft('m-conflict')
    const record = {
      action: { id: 'old', kind: 'measurement.upsert', entityId: survey.id,
        payload: survey as unknown as import('../src/core/sync/types').JsonValue,
        baseRevision: { version: 0, updatedAt: 0 }, createdAt: 1000 },
      status: 'conflict' as const, attempts: 1, nextAttemptAt: 1000,
      conflict: { revision: { version: 2, updatedAt: 2000 }, serverValue: { id: survey.id } },
    }
    await store.insert(record)
    const failing: SyncStore = {
      get: (id) => store.get(id), list: () => store.list(), update: (value) => store.update(value),
      insert: async () => { throw new Error('storage failure') },
    }
    const queue = new SyncQueue(failing, { send: async () => ({ kind: 'retry' }) })
    await expect(keepLocalMeasurement(survey, record, failing, queue, 1001, 'new'))
      .rejects.toThrow('storage failure')
    expect((await store.get('old'))?.status).toBe('conflict')
  })

  it('schedules retries from the queue deadline only while online', () => {
    expect(retryDelay(4000, 1000, true)).toBe(3000)
    expect(retryDelay(900, 1000, true)).toBe(1000)
    expect(retryDelay(4000, 1000, false)).toBeUndefined()
    expect(retryDelay(undefined, 1000, true)).toBeUndefined()
  })

  it('does not overwrite a conflicted server version', async () => {
    const store = new MemorySyncStore()
    const queue = new SyncQueue(store, { send: async () => ({
      kind: 'conflict', revision: { version: 2, updatedAt: 2000 }, serverValue: { id: 'm2' },
    }) })
    const survey = validDraft('m2')
    await queue.setOnline(true, 1000)
    expect(await enqueueLatestMeasurement(survey, store, queue, 1000, 'a1')).toBe('queued')
    expect(await enqueueLatestMeasurement(survey, store, queue, 1001, 'a2')).toBe('conflict')
    expect((await store.list()).length).toBe(1)
  })

  it('keepServer: сервер нұсқасын таңдағаннан кейін қайта қайшылыққа түспейді', async () => {
    // Сервер: нұсқасы base-пен сәйкес келмесе — conflict (applyMeasurementSync сияқты).
    const server = { value: null as unknown, revision: { version: 0, updatedAt: 0 } }
    const sent: string[] = []
    const store = new MemorySyncStore()
    const queue = new SyncQueue(store, { send: async (action) => {
      sent.push(action.id)
      if (server.revision.version !== action.baseRevision.version || server.revision.updatedAt !== action.baseRevision.updatedAt) {
        return { kind: 'conflict', revision: server.revision, serverValue: server.value as import('../src/core/sync/types').JsonValue }
      }
      server.value = action.payload
      server.revision = { version: server.revision.version + 1, updatedAt: 5000 + server.revision.version }
      return { kind: 'applied', revision: server.revision }
    } })
    await queue.setOnline(true, 1000)
    const mine = validDraft('m-keep-server')
    expect(await enqueueLatestMeasurement(mine, store, queue, 1001, 'a1')).toBe('queued')
    // Басқа құрылғы серверде өзгертті.
    const theirs = updateMeasure(mine, 'height', 2800, 'laser', 1100)
    server.value = theirs
    server.revision = { version: 2, updatedAt: 9000 }
    const edited = updateMeasure(mine, 'height', 2650, 'manual', 1200)
    expect(await enqueueLatestMeasurement(edited, store, queue, 1201, 'a2')).toBe('queued')
    expect((await store.get('a2'))?.status).toBe('conflict')
    // Беттегі «Серверлікін қалдыру»: қайшылық жабылып, жергілікті жоба сервер мәніне ауысады.
    await queue.resolveConflict('a2', { kind: 'keepServer' }, 1300)
    // reconcile() сол мәнді қайта ұсынады — ол бұрыннан серверде, жаңа әрекет қажет емес.
    expect(await enqueueLatestMeasurement(theirs, store, queue, 1301, 'a3')).toBe('unchanged')
    expect((await store.list()).filter((record) => record.status === 'conflict')).toEqual([])
    // Кейінгі жергілікті түзету сервердің соңғы нұсқасынан басталады.
    const later = updateMeasure(theirs, 'height', 2900, 'manual', 1400)
    expect(await enqueueLatestMeasurement(later, store, queue, 1401, 'a4')).toBe('queued')
    expect((await store.get('a4'))?.status).toBe('sent')
    expect(sent).toEqual(['a1', 'a2', 'a4'])
  })
})
