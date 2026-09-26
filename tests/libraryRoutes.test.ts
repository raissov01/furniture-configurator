import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { catalogOf, defaultShopProfile } from '../src/core/index'
import { createLibraryItem } from '../src/core/library'
import type { SceneNode } from '../src/core/tree'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-library-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' | 'designer' | 'shop' | 'client' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))
let auth: typeof import('../lib/server/auth')
let route: typeof import('../app/api/library/route')
let database: typeof import('../lib/server/db')
beforeAll(async () => { auth = await import('../lib/server/auth'); route = await import('../app/api/library/route'); database = await import('../lib/server/db') })

const catalog = catalogOf(defaultShopProfile())
const node: SceneNode = { kind: 'solid', id: 'solid', name: 'Декор',
  transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, solid: { size: { x: 100, y: 200, z: 300 } } }
const item = createLibraryItem(node, catalog, 'Декор', '2026-09-25T00:00:00.000Z', 'entry')

describe('аккаунт кітапханасы API', () => {
  it('тек өзінің элементін сақтайды, оқиды және өшіреді', async () => {
    const first = auth.register('library-one@example.kz', 'password123', 'Бірінші')
    const second = auth.register('library-two@example.kz', 'password123', 'Екінші')
    if (!first.ok || !second.ok) throw new Error('registration failed')
    actor.value = first.account
    const save = await route.POST(new Request('http://localhost/api/library', { method: 'POST', body: JSON.stringify({ item }) }))
    expect(save.status).toBe(200)
    expect((await route.GET()).status).toBe(200)
    actor.value = second.account
    expect((await (await route.GET()).json() as { items: unknown[] }).items).toEqual([])
    expect((await route.DELETE(new Request('http://localhost/api/library', { method: 'DELETE',
      body: JSON.stringify({ id: item.id }) }))).status).toBe(404)
    actor.value = first.account
    expect((await route.DELETE(new Request('http://localhost/api/library', { method: 'DELETE',
      body: JSON.stringify({ id: item.id }) }))).status).toBe(200)
    expect((await (await route.GET()).json() as { items: unknown[] }).items).toEqual([])
  })

  it('сессиясыз және бүлінген элементті 4xx-пен қайтарады', async () => {
    actor.value = null
    expect((await route.GET()).status).toBe(401)
    const owner = auth.register('library-invalid@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    expect((await route.POST(new Request('http://localhost/api/library', { method: 'POST',
      body: JSON.stringify({ item: { ...item, schemaVersion: 99 } }) }))).status).toBe(400)
  })

  it('бір бүлінген жолды өткізіп, санын жауапта көрсетеді', async () => {
    const owner = auth.register('library-corrupt@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    const insert = database.db().prepare('INSERT INTO library_items (user_id, id, json, updated_at) VALUES (?, ?, ?, ?)')
    insert.run(owner.account.userId, item.id, JSON.stringify(item), 1)
    insert.run(owner.account.userId, 'broken', '{', 2)
    const response = await route.GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: [item], skipped: 1 })
  })

  it('200 элемент шегінде бар элементті жаңартады, жаңасын 4xx қайтарады', async () => {
    const owner = auth.register('library-limit@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    const insert = database.db().prepare('INSERT INTO library_items (user_id, id, json, updated_at) VALUES (?, ?, ?, ?)')
    for (let i = 0; i < 200; i += 1) insert.run(owner.account.userId, i ? `item-${i}` : item.id, JSON.stringify(item), i)
    expect((await route.POST(new Request('http://localhost/api/library', { method: 'POST',
      body: JSON.stringify({ item }) }))).status).toBe(200)
    const another = { ...item, id: 'over-limit' }
    expect((await route.POST(new Request('http://localhost/api/library', { method: 'POST',
      body: JSON.stringify({ item: another }) }))).status).toBe(409)
  })
})
