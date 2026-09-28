import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import config, { OFFLINE_PAGE, resolveHybridTarget } from '../capacitor.config'
import { IndexedDbMobileStore } from '../lib/mobile/indexedDb'
import { createMobileSyncTransport } from '../lib/mobile/syncTransport'
import { OBSTACLE_KINDS } from '../src/core/measure'
import type { MeasurementSurvey } from '../src/core/measure'
import { SyncQueue } from '../src/core/sync/queue'
import type { SyncRecord } from '../src/core/sync/types'
import { enqueueLatestMeasurement } from '../components/mobile/measurementSync'
import {
  AUTH_REQUIRED_REASON, AUTO_OPEN_COOLDOWN_MS, authRetryCandidates, offlineShellNext, pendingMeasurementCount,
  saveOfflineMeasurement, surveySyncState,
} from '../components/mobile/offlineHandoff'
import { retryRejectedMeasurement } from '../components/mobile/measurementSync'

const n = (value: number) => ({ value, source: 'manual' as const, capturedAt: 1000 })
const obstacles = () => Object.fromEntries(OBSTACLE_KINDS.map((kind) => [kind, {
  status: 'absent', photoRef: 'photo-1', location: null,
}])) as MeasurementSurvey['walls']['north']['obstacles']
const survey = (id = 'measure-1', height = 2700): MeasurementSurvey => ({
  id, height: n(height),
  walls: {
    north: { length: n(3200), obstacles: obstacles() },
    east: { length: n(2400), obstacles: obstacles() },
    south: { length: n(3200), obstacles: obstacles() },
    west: { length: n(2400), obstacles: obstacles() },
  },
  corners: { northWest: n(90), northEast: n(90), southEast: n(90), southWest: n(90) },
})
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() })
})

describe('гибрид: сервер мекенжайы бір айнымалыда', () => {
  it('әдепкісі staging, бастапқы бет /mobile, офлайн бет сол origin-де', () => {
    expect(resolveHybridTarget(undefined)).toEqual({
      origin: 'https://mebel-test.85.137.91.47.sslip.io',
      hostname: 'mebel-test.85.137.91.47.sslip.io',
      startUrl: 'https://mebel-test.85.137.91.47.sslip.io/mobile',
      offlineUrl: `https://mebel-test.85.137.91.47.sslip.io/${OFFLINE_PAGE}`,
    })
  })

  it('продқа ауыстыру: тек AISMEBEL_APP_URL; жол берілсе сол жол', () => {
    expect(resolveHybridTarget('https://mebel.balu-fit.com/').startUrl).toBe('https://mebel.balu-fit.com/mobile')
    expect(resolveHybridTarget(' https://mebel.balu-fit.com/mobile/scan ').startUrl).toBe('https://mebel.balu-fit.com/mobile/scan')
  })

  it('http, құпиясөзді не бұзық URL-ды қабылдамайды', () => {
    expect(() => resolveHybridTarget('http://mebel.balu-fit.com')).toThrow(/https/)
    expect(() => resolveHybridTarget('https://u:p@mebel.balu-fit.com')).toThrow(/логин/)
    expect(() => resolveHybridTarget('mebel.balu-fit.com')).toThrow(/URL емес/)
  })

  it('Capacitor: hostname = сервер хосты (ортақ IndexedDB/cookie), errorPath = офлайн бет, навигация тек өз хост', () => {
    const target = resolveHybridTarget(process.env['AISMEBEL_APP_URL'])
    expect(config.server).toMatchObject({
      url: target.startUrl, hostname: target.hostname, androidScheme: 'https',
      errorPath: OFFLINE_PAGE, allowNavigation: [target.hostname],
    })
  })
})

describe('гибрид: офлайн өлшем аккаунтқа жетеді', () => {
  it('офлайн бет желіге шықпай кезекке қояды; /mobile сол журналды cookie-мен жібереді', async () => {
    // 1) Офлайн бет: байланыс жоқ, transport шақырылса — сынақ құлайды.
    const offline = await IndexedDbMobileStore.open('hybrid-shared')
    await offline.putPhoto('photo-1', jpeg())
    const offlineQueue = new SyncQueue(offline, createMobileSyncTransport(offline, async () => { throw new Error('желіге шықпауы керек') }))
    expect(await saveOfflineMeasurement(survey(), offline, offlineQueue, 1000, 'action-offline')).toBe('queued')
    expect(pendingMeasurementCount(await offline.list())).toBe(1)
    expect(surveySyncState(await offline.list(), 'measure-1')).toBe('pending')
    offline.close()

    // 2) Байланыс келді: WebView сол origin-дегі /mobile-ді ашады, сол DB-ны оқиды.
    const online = await IndexedDbMobileStore.open('hybrid-shared')
    const calls: { url: string; credentials: RequestCredentials | undefined; body: unknown }[] = []
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), credentials: init?.credentials, body: init?.body })
      return String(input).includes('/photos/') ? Response.json({ kind: 'applied' })
        : Response.json({ kind: 'applied', revision: { version: 1, updatedAt: 2000 } })
    }
    const queue = new SyncQueue(online, createMobileSyncTransport(online, fetcher))
    await queue.setOnline(true, 3000)
    expect(calls.map((call) => [call.url, call.credentials])).toEqual([
      ['/api/mobile/photos/photo-1', 'same-origin'],
      ['/api/mobile/measure/sync', 'same-origin'],
    ])
    expect(JSON.parse(String(calls[1]?.body))).toMatchObject({ id: 'action-offline', entityId: 'measure-1' })
    expect(surveySyncState(await online.list(), 'measure-1')).toBe('sent')
    expect(pendingMeasurementCount(await online.list())).toBe(0)
    online.close()
  })

  it('кірмеген күйде 401 → «Кіру қажет»; кіргеннен кейін автоматты қайта жіберіледі', async () => {
    const store = await IndexedDbMobileStore.open('hybrid-auth')
    await store.putPhoto('photo-1', jpeg())
    let loggedIn = false
    const fetcher: typeof fetch = async (input) => {
      if (!loggedIn) return Response.json({ error: AUTH_REQUIRED_REASON }, { status: 401 })
      return String(input).includes('/photos/') ? Response.json({ kind: 'duplicate' })
        : Response.json({ kind: 'applied', revision: { version: 1, updatedAt: 5000 } })
    }
    const queue = new SyncQueue(store, createMobileSyncTransport(store, fetcher))
    await saveOfflineMeasurement(survey(), store, queue, 1000, 'action-1')
    await queue.setOnline(true, 2000)
    const records = await store.list()
    expect(records[0]).toMatchObject({ status: 'rejected', error: AUTH_REQUIRED_REASON })
    expect(authRetryCandidates(records, null)).toEqual([])
    expect(authRetryCandidates(records, 'shop')).toEqual([])

    loggedIn = true
    for (const record of authRetryCandidates(records, 'designer')) {
      await retryRejectedMeasurement(survey(), record, store, queue, 3000, 'action-2')
    }
    expect(surveySyncState(await store.list(), 'measure-1')).toBe('sent')
    expect(authRetryCandidates(await store.list(), 'designer')).toEqual([])
    store.close()
  })

  it('офлайнда қайта өңделген өлшем: бір ғана pending, соңғы нұсқасы /mobile reconcile-де кетеді', async () => {
    const store = await IndexedDbMobileStore.open('hybrid-edit')
    await store.putPhoto('photo-1', jpeg())
    const sent: unknown[] = []
    const queue = new SyncQueue(store, createMobileSyncTransport(store, async (input, init) => {
      if (!String(input).includes('/photos/')) sent.push(JSON.parse(String(init?.body)))
      return String(input).includes('/photos/') ? Response.json({ kind: 'applied' })
        : Response.json({ kind: 'applied', revision: { version: sent.length, updatedAt: 1000 + sent.length } })
    }))
    expect(await saveOfflineMeasurement(survey('m', 2700), store, queue, 1000, 'a1')).toBe('queued')
    expect(await saveOfflineMeasurement(survey('m', 2710), store, queue, 1100, 'a2')).toBe('pending')
    expect(pendingMeasurementCount(await store.list())).toBe(1)
    await queue.setOnline(true, 2000)
    // /mobile reconcile сияқты: сақталған соңғы черновикті кезекке қою.
    expect(await enqueueLatestMeasurement(survey('m', 2710), store, queue, 2100, 'a3')).toBe('queued')
    expect(sent.map((action) => (action as { payload: MeasurementSurvey }).payload.height.value)).toEqual([2700, 2710])
    store.close()
  })
})

describe('гибрид: таза шешімдер', () => {
  const record = (id: string, entityId: string, status: SyncRecord['status'], createdAt: number, error?: string): SyncRecord => ({
    action: { id, kind: 'measurement.upsert', entityId, payload: null, baseRevision: { version: 0, updatedAt: 0 }, createdAt },
    status, attempts: 1, nextAttemptAt: 0, ...(error ? { error } : {}),
  })

  it('өлшем күйі: шешілмеген мәселе жіберілгеннен жоғары', () => {
    const records = [record('1', 'a', 'sent', 1), record('2', 'a', 'conflict', 2), record('3', 'b', 'superseded', 1)]
    expect(surveySyncState(records, 'a')).toBe('conflict')
    expect(surveySyncState(records, 'b')).toBe('local')
    expect(surveySyncState(records, 'c')).toBe('local')
  })

  it('қайта жіберу: тек 401 себебі, әр өлшемнен ең соңғысы', () => {
    const records = [
      record('1', 'a', 'rejected', 1, AUTH_REQUIRED_REASON), record('2', 'a', 'rejected', 5, AUTH_REQUIRED_REASON),
      record('3', 'b', 'rejected', 2, 'Рұқсат жоқ'), record('4', 'c', 'pending', 3),
    ]
    expect(authRetryCandidates(records, 'owner').map((item) => item.action.id)).toEqual(['2'])
    expect(authRetryCandidates(records, 'client')).toEqual([])
  })

  it('офлайн беттен толық нұсқаға тек сервер жауап беріп, шебер жабық болғанда өтеді', () => {
    const base = { browserOnline: true, serverReachable: true, editing: false, lastAutoOpenAt: null, now: 100_000 }
    expect(offlineShellNext(base)).toBe('open-online')
    expect(offlineShellNext({ ...base, editing: true })).toBe('stay')
    expect(offlineShellNext({ ...base, serverReachable: false })).toBe('stay')
    expect(offlineShellNext({ ...base, browserOnline: false })).toBe('stay')
  })

  it('сервер /mobile-ге қате берсе, errorPath → офлайн бет → қайта өту циклі болмайды', () => {
    const base = { browserOnline: true, serverReachable: true, editing: false, now: 100_000 }
    expect(offlineShellNext({ ...base, lastAutoOpenAt: 100_000 - AUTO_OPEN_COOLDOWN_MS + 1 })).toBe('stay')
    expect(offlineShellNext({ ...base, lastAutoOpenAt: 100_000 - AUTO_OPEN_COOLDOWN_MS })).toBe('open-online')
  })
})
