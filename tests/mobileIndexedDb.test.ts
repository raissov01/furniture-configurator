import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbMobileStore } from '../lib/mobile/indexedDb'
import { SyncQueue } from '../src/core/sync/queue'
import { migrateV3ToV4 } from '../src/core/projectV4'
import { SEED_CATALOG } from '../src/core/index'
import type { SyncRecord } from '../src/core/sync/types'

const record: SyncRecord = {
  action: {
    id: 'action-1', kind: 'measurement.upsert', entityId: 'survey-1',
    payload: { id: 'survey-1' }, baseRevision: { version: 0, updatedAt: 0 }, createdAt: 10,
  },
  status: 'pending', attempts: 0, nextAttemptAt: 10,
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() })
})

describe('телефон IndexedDB сақтау қабаты', () => {
  it('әрекет ID-ін атомдық сақтайды және қайта ашқанда кезек жоғалмайды', async () => {
    const first = await IndexedDbMobileStore.open('mobile-queue-test')
    expect(await first.insert(record)).toBe(true)
    expect(await first.insert({ ...record, action: { ...record.action, payload: { id: 'changed' } } })).toBe(false)
    first.close()

    const reopened = await IndexedDbMobileStore.open('mobile-queue-test')
    expect(await reopened.list()).toEqual([record])
    await reopened.update({ ...record, attempts: 1, nextAttemptAt: 1010 })
    expect((await reopened.get('action-1'))?.attempts).toBe(1)
    reopened.close()
  })

  it('өлшем мен фотобайтты бірдей ID-мен қайта ашқанда сақтайды', async () => {
    const first = await IndexedDbMobileStore.open('mobile-media-test')
    await first.putSurvey('survey-1', { id: 'survey-1', height: 2500 })
    await first.putPhoto('photo-1', new Blob(['camera bytes'], { type: 'image/jpeg' }))
    first.close()

    const reopened = await IndexedDbMobileStore.open('mobile-media-test')
    expect(await reopened.getSurvey('survey-1')).toEqual({ id: 'survey-1', height: 2500 })
    expect(await (await reopened.getPhoto('photo-1'))?.text()).toBe('camera bytes')
    reopened.close()
  })

  it('офлайн кезектегі әрекетті қайта ашқанда бір рет жібереді', async () => {
    const first = await IndexedDbMobileStore.open('mobile-reconnect-test')
    const offline = new SyncQueue(first, { send: async () => { throw new Error('unexpected send') } })
    await offline.setOnline(false, 10)
    await offline.enqueue(record.action)
    first.close()

    const delivered: string[] = []
    const reopened = await IndexedDbMobileStore.open('mobile-reconnect-test')
    const online = new SyncQueue(reopened, { send: async (action) => {
      delivered.push(action.id)
      return { kind: 'applied', revision: { version: 1, updatedAt: 20 } }
    } })
    await online.setOnline(true, 20)
    await online.flush(21)
    expect(delivered).toEqual(['action-1'])
    expect((await reopened.get('action-1'))?.status).toBe('sent')
    reopened.close()
  })

  it('v4 жоба конфигін сақтайды, қате конфигті өткізбейді', async () => {
    const project = migrateV3ToV4({
      schemaVersion: 3, name: 'Сақталған жоба', materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [], room: { width: 4000, height: 2700, depth: 3000 }, placements: [],
    })
    const first = await IndexedDbMobileStore.open('mobile-project-test')
    await first.putProject('project-1', project)
    await expect(first.putProject('broken', { schemaVersion: 4, name: 'bad' })).rejects.toThrow()
    first.close()
    const reopened = await IndexedDbMobileStore.open('mobile-project-test')
    expect(await reopened.getProject('project-1')).toEqual(project)
    expect(await reopened.getProject('broken')).toBeUndefined()
    reopened.close()
  })
})
