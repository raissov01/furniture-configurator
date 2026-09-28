import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-catalog-image-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' | 'designer' | 'shop' | 'client' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))
let auth: typeof import('../lib/server/auth')
let catalog: typeof import('../lib/server/ownCatalog')
let route: typeof import('../app/api/own-catalog/image/route')
let images: typeof import('../lib/server/ownCatalogImages')
beforeAll(async () => {
  auth = await import('../lib/server/auth')
  catalog = await import('../lib/server/ownCatalog')
  route = await import('../app/api/own-catalog/image/route')
  images = await import('../lib/server/ownCatalogImages')
})

describe('жеке каталог сурет API', () => {
  it('расталған INI жазбасына суретті жүктеп, жоба URL-імен қайта оқиды', async () => {
    const registered = auth.register('texture-route@example.kz', 'password123', 'Textures')
    if (!registered.ok) throw new Error(registered.error)
    actor.value = registered.account
    const id = catalog.saveShopCatalog(registered.account.shopId, 'pro100-ini',
      { textures: [{ name: 'Oak', mapSizeMm: { x: 600, y: 450 } }] }, 100, registered.account.userId)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64')
    const path = `http://localhost/api/own-catalog/image?importId=${id}&textureName=Oak`
    const upload = (rights: string, texturePath = path) => route.POST(new Request(texturePath, {
      method: 'POST', headers: { 'x-rights-confirmed': rights, 'content-type': 'image/png' }, body: png,
    }))
    expect((await upload('false')).status).toBe(400)
    expect((await upload('true', path.replace('Oak', 'Unknown'))).status).toBe(404)
    const saved = await upload('true')
    expect(saved.status).toBe(201)
    const { url } = await saved.json() as { url: string }
    actor.value = null
    expect((await route.GET(new Request(url))).status).toBe(401)
    const other = auth.register('other-texture-route@example.kz', 'password123', 'Other textures')
    if (!other.ok) throw new Error(other.error)
    actor.value = other.account
    expect((await route.GET(new Request(url))).status).toBe(404)
    actor.value = registered.account
    const fetched = await route.GET(new Request(url))
    expect(fetched.status).toBe(200)
    expect(fetched.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(Uint8Array.from(png))
  })

  it('әр цехтың сурет квотасын бөлек есептейді', () => {
    const first = auth.register('texture-quota-1@example.kz', 'password123', 'Quota one')
    const second = auth.register('texture-quota-2@example.kz', 'password123', 'Quota two')
    if (!first.ok || !second.ok) throw new Error('Тест аккаунты құрылмады')
    const firstImport = catalog.saveShopCatalog(first.account.shopId, 'pro100-ini', { textures: [] }, 10, first.account.userId)
    const secondImport = catalog.saveShopCatalog(second.account.shopId, 'pro100-ini', { textures: [] }, 10, second.account.userId)
    images.recordCatalogImage(first.account.shopId, firstImport, randomUUID(), 'png', 7, 10)
    expect(() => images.recordCatalogImage(first.account.shopId, firstImport, randomUUID(), 'png', 4, 10))
      .toThrow(/квота/iu)
    expect(() => images.recordCatalogImage(second.account.shopId, secondImport, randomUUID(), 'png', 4, 10))
      .not.toThrow()
  })
})
