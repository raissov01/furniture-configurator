import { describe, expect, it } from 'vitest'
import {
  MemorySyncStore,
  SyncQueue,
  backoffMs,
  hasRevisionConflict,
  type SyncAction,
  type SyncTransport,
} from '../src/core/sync'

const action = (id: string, baseVersion = 1): SyncAction => ({
  id,
  kind: 'project.save',
  entityId: 'project-1',
  payload: { name: 'Ас үй' },
  baseRevision: { version: baseVersion, updatedAt: 100 },
  createdAt: 200,
})

describe('офлайн синхрон кезегі', () => {
  it('желі жоқта журналда сақтап, қайта қосылғанда өзі жібереді', async () => {
    const store = new MemorySyncStore()
    const sent: string[] = []
    const transport: SyncTransport = { send: async (item) => {
      sent.push(item.id)
      return { kind: 'applied', revision: { version: 2, updatedAt: 300 } }
    } }
    const queue = new SyncQueue(store, transport)
    await queue.enqueue(action('a'))
    expect(queue.network).toBe('unknown')
    expect(sent).toEqual([])
    expect((await store.get('a'))?.status).toBe('pending')
    await queue.setOnline(false, 250)
    expect(queue.network).toBe('offline')
    await queue.setOnline(true, 300)
    expect(queue.network).toBe('online')
    expect(sent).toEqual(['a'])
    expect((await store.get('a'))?.status).toBe('sent')
  })

  it('жаңа queue инстансы сол журналды қайта оқиды', async () => {
    const store = new MemorySyncStore()
    await new SyncQueue(store, { send: async () => { throw new Error('offline') } }).enqueue(action('a'))
    const queue = new SyncQueue(store, { send: async () => ({ kind: 'applied', revision: { version: 2, updatedAt: 300 } }) })
    await queue.setOnline(true, 400)
    expect((await store.get('a'))?.status).toBe('sent')
  })

  it('журнал жазу қатесін желі қатесі деп жасырып қоймайды', async () => {
    class BrokenStore extends MemorySyncStore {
      override async update(): Promise<void> { throw new Error('storage full') }
    }
    const store = new BrokenStore()
    const queue = new SyncQueue(store, { send: async () => ({ kind: 'applied', revision: { version: 2, updatedAt: 300 } }) })
    await queue.enqueue(action('a'))
    await expect(queue.setOnline(true, 400)).rejects.toThrow('storage full')
    expect(queue.network).toBe('online')
  })

  it('желі ашық кезде жаңа әрекет кезек күтпей жіберіледі', async () => {
    const store = new MemorySyncStore()
    const queue = new SyncQueue(store, { send: async () => ({ kind: 'applied', revision: { version: 2, updatedAt: 300 } }) })
    await queue.setOnline(true, 100)
    await queue.enqueue(action('a'))
    expect((await store.get('a'))?.status).toBe('sent')
  })

  it('бірінші жіберу жүріп жатқанда қосылған әрекет те жіберіледі', async () => {
    const store = new MemorySyncStore()
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const sent: string[] = []
    const queue = new SyncQueue(store, { send: async (item) => {
      sent.push(item.id)
      if (item.id === 'a') await gate
      return { kind: 'applied', revision: { version: 2, updatedAt: 300 } }
    } })
    await queue.setOnline(true, 100)
    const first = queue.enqueue(action('a'))
    await Promise.resolve()
    const second = queue.enqueue(action('b'))
    release?.()
    await Promise.all([first, second])
    expect(sent).toEqual(['a', 'b'])
    expect((await store.get('b'))?.status).toBe('sent')
  })

  it('қайта enqueue және қатар flush бір id-ді бір рет жібереді', async () => {
    const store = new MemorySyncStore()
    let sends = 0
    const queue = new SyncQueue(store, { send: async () => {
      sends++
      return { kind: 'applied', revision: { version: 2, updatedAt: 300 } }
    } })
    await queue.enqueue(action('a'))
    await queue.enqueue(action('a'))
    await expect(queue.enqueue({ ...action('a'), payload: { name: 'Басқа' } })).rejects.toThrow(/id/)
    await Promise.all([queue.setOnline(true, 300), queue.flush(300), queue.flush(300)])
    expect(sends).toBe(1)
    await queue.flush(400)
    expect(sends).toBe(1)
    expect(await store.list()).toHaveLength(1)
  })

  it('жауап жоғалса сол id қайталанады, backoff шектеледі', async () => {
    const store = new MemorySyncStore()
    const sent: string[] = []
    const queue = new SyncQueue(store, { send: async (item) => {
      sent.push(item.id)
      return sent.length === 1 ? { kind: 'retry' } : { kind: 'duplicate', revision: { version: 2, updatedAt: 300 } }
    } })
    await queue.enqueue(action('a'))
    await queue.setOnline(true, 1000)
    expect((await store.get('a'))?.nextAttemptAt).toBe(2000)
    await queue.flush(1999)
    expect(sent).toEqual(['a'])
    await queue.flush(2000)
    expect(sent).toEqual(['a', 'a'])
    expect((await store.get('a'))?.status).toBe('sent')
    expect(backoffMs(99)).toBe(60_000)
  })

  it('сервер нұсқасы не уақыты өзгерсе екі нұсқаны сақтайды; таңдау ғана шешеді', async () => {
    const server = { version: 3, updatedAt: 900 }
    const store = new MemorySyncStore()
    const queue = new SyncQueue(store, { send: async (item) => item.id === 'a'
      ? { kind: 'conflict', revision: server, serverValue: { name: 'Сервердегі' } }
      : { kind: 'applied', revision: { version: 4, updatedAt: 1200 } } })
    await queue.enqueue(action('a'))
    await queue.setOnline(true, 1000)
    expect((await store.get('a'))?.status).toBe('conflict')
    expect((await store.get('a'))?.conflict?.serverValue).toEqual({ name: 'Сервердегі' })
    expect((await store.get('a'))?.action.payload).toEqual({ name: 'Ас үй' })
    await queue.flush(1100)
    expect(hasRevisionConflict({ version: 3, updatedAt: 800 }, server)).toBe(true)
    expect(hasRevisionConflict(server, server)).toBe(false)
    await queue.resolveConflict('a', { kind: 'keepLocal', newId: 'b' }, 1200)
    expect((await store.get('a'))?.status).toBe('superseded')
    expect((await store.get('b'))?.action.baseRevision).toEqual(server)
    expect((await store.get('b'))?.status).toBe('sent')
  })

  it('серверді таңдағанда жергілікті нұсқа журналда тоқтайды және сервер дерегі қайтады', async () => {
    const store = new MemorySyncStore()
    const queue = new SyncQueue(store, { send: async () => ({
      kind: 'conflict', revision: { version: 2, updatedAt: 300 }, serverValue: { name: 'Сервер' },
    }) })
    await queue.enqueue(action('a'))
    await queue.setOnline(true, 500)
    expect(await queue.resolveConflict('a', { kind: 'keepServer' }, 600)).toEqual({ name: 'Сервер' })
    expect((await store.get('a'))?.status).toBe('superseded')
  })

  it('желілік қатеден соң reachable күйі түседі, reconnect кезінде ғана әрекет жалғасады', async () => {
    const store = new MemorySyncStore()
    let calls = 0
    const queue = new SyncQueue(store, { send: async () => {
      calls++
      if (calls === 1) throw new Error('network down')
      return { kind: 'applied', revision: { version: 2, updatedAt: 300 } }
    } })
    await queue.enqueue(action('a'))
    await queue.setOnline(true, 1000)
    expect(queue.network).toBe('unreachable')
    expect((await store.get('a'))?.status).toBe('pending')
    await queue.setOnline(true, 1500)
    expect(queue.network).toBe('online')
    expect((await store.get('a'))?.status).toBe('sent')
  })
})
