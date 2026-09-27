import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbMobileStore } from '../lib/mobile/indexedDb'
import { SyncQueue } from '../src/core/sync/queue'
import { migrateV3ToV4 } from '../src/core/projectV4'
import { SEED_CATALOG } from '../src/core/index'
import type { SyncRecord } from '../src/core/sync/types'
import { createInstallationTask } from '../src/core/installation'

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
  it('басқа қойынды schema нұсқасын өсірсе байланысын жауып қайта ашу белгісін береді', async () => {
    const first = await IndexedDbMobileStore.open('mobile-version-change')
    let changed = false
    first.onVersionChange = () => { changed = true }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('mobile-version-change', 3)
      request.onsuccess = () => { request.result.close(); resolve() }
      request.onerror = () => reject(request.error)
    })
    expect(changed).toBe(true)
  })
  it('монтаж актісі мен фото черновигін база жаңарғаннан кейін де сақтайды', async () => {
    const factory = new IDBFactory()
    const old = factory.open('mobile-installation', 1)
    await new Promise<void>((resolve, reject) => {
      old.onupgradeneeded = () => { old.result.createObjectStore('surveys', { keyPath: 'id' }) }
      old.onsuccess = () => { old.result.close(); resolve() }
      old.onerror = () => reject(old.error)
    })
    const first = await IndexedDbMobileStore.open('mobile-installation', factory)
    const task = createInstallationTask('task-1', 'project-1', ['panel-1'], 1000)
    await first.putInstallation(task)
    await first.putInstallationDraft('task-1', { delivery: 'data:image/jpeg;base64,/9j/2Q==' })
    first.close()
    const reopened = await IndexedDbMobileStore.open('mobile-installation', factory)
    expect(await reopened.getInstallation('task-1')).toEqual(task)
    expect(await reopened.getInstallationDraft('task-1')).toEqual({ delivery: 'data:image/jpeg;base64,/9j/2Q==' })
    reopened.close()
  })
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

  it('жауап ауысқанда сілтемесі жойылған фотоны тазалайды', async () => {
    const store = await IndexedDbMobileStore.open('mobile-orphan-photo-test')
    await store.putPhoto('old-photo', new Blob(['old'], { type: 'image/jpeg' }))
    await store.putSurvey('survey-1', { id: 'survey-1', walls: { north: { obstacles: { socket: { photoRef: 'old-photo' } } } } })
    await store.putSurvey('survey-1', { id: 'survey-1', walls: { north: { obstacles: { socket: { photoRef: null } } } } })
    expect(await store.getPhoto('old-photo')).toBeUndefined()
    store.close()
  })

  it('басқа замерге не кезектегі әрекетке қажет фотоны сақтайды', async () => {
    const store = await IndexedDbMobileStore.open('mobile-shared-photo-test')
    for (const id of ['shared-photo', 'pending-photo']) {
      await store.putPhoto(id, new Blob([id], { type: 'image/jpeg' }))
    }
    await store.putSurvey('survey-1', { id: 'survey-1', refs: [{ photoRef: 'shared-photo' }, { photoRef: 'pending-photo' }] })
    await store.putSurvey('survey-2', { id: 'survey-2', ref: { photoRef: 'shared-photo' } })
    await store.insert({ ...record, action: { ...record.action, payload: { id: 'survey-1', ref: { photoRef: 'pending-photo' } } } })
    await store.putSurvey('survey-1', { id: 'survey-1', refs: [] })
    expect(await store.getPhoto('shared-photo')).toBeDefined()
    expect(await store.getPhoto('pending-photo')).toBeDefined()
    store.close()
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
