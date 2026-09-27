import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbMobileStore } from '../lib/mobile/indexedDb'
import { createMobileSyncTransport } from '../lib/mobile/syncTransport'
import { createMeasurementSyncAction, OBSTACLE_KINDS } from '../src/core/measure'
import type { MeasurementSurvey } from '../src/core/measure'

const n = (value: number) => ({ value, source: 'manual' as const, capturedAt: 1000 })
const obstacles = () => Object.fromEntries(OBSTACLE_KINDS.map((kind) => [kind, {
  status: 'absent', photoRef: 'photo-1', location: null,
}])) as MeasurementSurvey['walls']['north']['obstacles']
const survey = (): MeasurementSurvey => ({
  id: 'measure-1', height: n(2700),
  walls: {
    north: { length: n(3200), obstacles: obstacles() },
    east: { length: n(2400), obstacles: obstacles() },
    south: { length: n(3200), obstacles: obstacles() },
    west: { length: n(2400), obstacles: obstacles() },
  },
  corners: { northWest: n(90), northEast: n(90), southEast: n(90), southWest: n(90) },
})

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() })
})

describe('телефон синхрон тасымалы', () => {
  it('фото байтын алдымен жібереді, содан кейін тұрақты action ID-ін жібереді', async () => {
    const store = await IndexedDbMobileStore.open('transport-order')
    await store.putPhoto('photo-1', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }))
    const calls: { url: string; body: BodyInit | null | undefined }[] = []
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: init?.body })
      return Response.json(calls.length === 1 ? { kind: 'applied' } : {
        kind: 'applied', revision: { version: 1, updatedAt: 2000 },
      })
    }
    const action = createMeasurementSyncAction(survey(), 'action-1', { version: 0, updatedAt: 0 }, 1000)
    expect(await createMobileSyncTransport(store, fetcher).send(action)).toEqual({
      kind: 'applied', revision: { version: 1, updatedAt: 2000 },
    })
    expect(calls.map((call) => call.url)).toEqual([
      '/api/mobile/photos/photo-1', '/api/mobile/measure/sync',
    ])
    expect(calls[0]?.body).toBeInstanceOf(Blob)
    expect(JSON.parse(String(calls[1]?.body))).toMatchObject({ id: 'action-1', baseRevision: { version: 0 } })
    store.close()
  })

  it('жергілікті фото жоғалса әрекетті жібермейді; сервер қайшылығын жоғалтпайды', async () => {
    const store = await IndexedDbMobileStore.open('transport-conflict')
    const action = createMeasurementSyncAction(survey(), 'action-1', { version: 0, updatedAt: 0 }, 1000)
    let calls = 0
    const fetcher: typeof fetch = async () => { calls += 1; return Response.json({ kind: 'applied' }) }
    expect(await createMobileSyncTransport(store, fetcher).send(action)).toMatchObject({ kind: 'rejected' })
    expect(calls).toBe(0)
    await store.putPhoto('photo-1', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }))
    const conflictFetch: typeof fetch = async (input) => String(input).includes('/photos/')
      ? Response.json({ kind: 'duplicate' })
      : Response.json({ kind: 'conflict', revision: { version: 2, updatedAt: 3000 }, serverValue: survey() }, { status: 409 })
    expect(await createMobileSyncTransport(store, conflictFetch).send(action)).toEqual({
      kind: 'duplicate', revision: { version: 2, updatedAt: 3000 },
    })
    const changed = survey()
    changed.height.value = 2800
    const differentFetch: typeof fetch = async (input) => String(input).includes('/photos/')
      ? Response.json({ kind: 'duplicate' })
      : Response.json({ kind: 'conflict', revision: { version: 3, updatedAt: 3001 }, serverValue: changed }, { status: 409 })
    expect(await createMobileSyncTransport(store, differentFetch).send(action)).toMatchObject({ kind: 'conflict' })
    store.close()
  })

  it('қайшылық емес 409 шексіз қайталанбайды: себебімен rejected болады', async () => {
    const store = await IndexedDbMobileStore.open('transport-409')
    await store.putPhoto('photo-1', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }))
    const fetcher: typeof fetch = async (input) => String(input).includes('/photos/')
      ? Response.json({ kind: 'duplicate' })
      : Response.json({ error: 'baseRevision: жоқ өлшемнің нұсқасы 0 болуы керек' }, { status: 409 })
    const action = createMeasurementSyncAction(survey(), 'action-409', { version: 3, updatedAt: 3000 }, 1000)
    expect(await createMobileSyncTransport(store, fetcher).send(action)).toEqual({
      kind: 'rejected', reason: 'baseRevision: жоқ өлшемнің нұсқасы 0 болуы керек',
    })
    store.close()
  })
  it('фотоға 413 келсе нақты өлшем шегін көрсетеді', async () => {
    const store = await IndexedDbMobileStore.open('transport-413')
    await store.putPhoto('photo-1', new Blob(['photo'], { type: 'image/jpeg' }))
    const result = await createMobileSyncTransport(store, async () => new Response(null, { status: 413 }))
      .send(createMeasurementSyncAction(survey(), 'action-413', { version: 0, updatedAt: 0 }, 1000))
    expect(result).toEqual({ kind: 'rejected', reason: expect.stringContaining('8 МБ') })
    store.close()
  })
  it('монтаждың 422 жауабындағы себепті жоғалтпайды', async () => {
    const store = await IndexedDbMobileStore.open('installation-422')
    const action = { id: 'close-1', kind: 'installation.close', entityId: 'task-1', payload: {},
      baseRevision: { version: 1, updatedAt: 1000 }, createdAt: 2000 }
    const result = await createMobileSyncTransport(store, async () =>
      Response.json({ error: 'Барлық пункт пен фото міндетті' }, { status: 422 })).send(action)
    expect(result).toEqual({ kind: 'rejected', reason: 'Барлық пункт пен фото міндетті' })
    store.close()
  })
})
