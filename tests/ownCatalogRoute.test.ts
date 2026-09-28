import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { simpleTableXlsx } from '../src/core/export/xlsx'
import { DEFAULT_BASIS_COLUMNS } from '../src/core/ownCatalogImport'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-own-catalog-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' | 'designer' | 'shop' | 'client' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))
let auth: typeof import('../lib/server/auth')
let route: typeof import('../app/api/own-catalog/route')
let catalog: typeof import('../lib/server/ownCatalog')
beforeAll(async () => {
  auth = await import('../lib/server/auth')
  route = await import('../app/api/own-catalog/route')
  catalog = await import('../lib/server/ownCatalog')
})

const ini = '[Oak]\nxmm=100\nymm=200\ndiffuse=0.5\n'
const request = (body: string, rights = 'true', format = 'pro100-ini') => new Request(`http://localhost/api/own-catalog?format=${format}`, {
  method: 'POST', headers: { 'x-rights-confirmed': rights }, body,
})

describe('цехтың жеке каталогы API', () => {
  it('растаусыз жүктемейді; екі цехтың деректерін серверде бөледі', async () => {
    const a = auth.register('catalog-a@example.kz', 'password123', 'A')
    const b = auth.register('catalog-b@example.kz', 'password123', 'B')
    if (!a.ok || !b.ok) throw new Error('Тіркелу орындалмады')
    actor.value = a.account
    expect((await route.POST(request(ini, 'false'))).status).toBe(400)
    const saved = await route.POST(request(ini))
    expect(saved.status).toBe(201)
    const id = (await saved.json() as { id: string }).id
    expect((await (await route.GET()).json() as { imports: unknown[] }).imports).toHaveLength(1)
    actor.value = b.account
    expect((await (await route.GET()).json() as { imports: unknown[] }).imports).toEqual([])
    expect((await route.DELETE(new Request(`http://localhost/api/own-catalog?id=${id}`, { method: 'DELETE' }))).status).toBe(404)
    actor.value = a.account
    expect((await route.DELETE(new Request(`http://localhost/api/own-catalog?id=${id}`, { method: 'DELETE' }))).status).toBe(200)
  })

  it('файл шегін және цех квотасын бақылайды', async () => {
    const a = auth.register('catalog-quota@example.kz', 'password123', 'Q')
    if (!a.ok) throw new Error(a.error)
    actor.value = a.account
    const oversized = new Request('http://localhost/api/own-catalog?format=pro100-ini', { method: 'POST',
      headers: { 'x-rights-confirmed': 'true', 'content-length': '10000001' }, body: ini })
    expect((await route.POST(oversized)).status).toBe(413)
    expect(() => catalog.saveShopCatalog(a.account.shopId, 'pro100-ini', { textures: [] }, 6, a.account.userId, 5)).toThrow(/квота/i)
  })

  it('Базис Excel баған картасымен алдын ала көрсетеді, сақтауды тек бөлек сұрауда орындайды', async () => {
    const a = auth.register('catalog-preview@example.kz', 'password123', 'Preview')
    if (!a.ok) throw new Error(a.error)
    actor.value = a.account
    const xlsx = simpleTableXlsx('Sheet1', ['Code', 'Name', 'Group', 'T', 'L', 'W', 'X', 'Y'], [
      ['A1', 'ЛДСП, Дуб', '01/ЛДСП/Egger', 16, 2800, 2070, 0, 0],
    ])
    const columns = { articul: 'Code', name: 'Name', group: 'Group', thickness: 'T', length: 'L', width: 'W', stepX: 'X', stepY: 'Y' }
    const response = await route.POST(new Request('http://localhost/api/own-catalog?format=basis-xlsx&preview=1', {
      method: 'POST', headers: { 'x-rights-confirmed': 'true', 'x-column-map': JSON.stringify(columns) }, body: Buffer.from(xlsx),
    }))
    expect(response.status).toBe(200)
    expect((await response.json() as { preview: { materials: unknown[] } }).preview.materials).toHaveLength(1)
    expect((await (await route.GET()).json() as { imports: unknown[] }).imports).toEqual([])
  })

  it('браузер UTF-8 баған картасын ASCII header арқылы жібереді', async () => {
    const a = auth.register('catalog-utf8@example.kz', 'password123', 'UTF8')
    if (!a.ok) throw new Error(a.error)
    actor.value = a.account
    const xlsx = simpleTableXlsx('Sheet1', Object.values(DEFAULT_BASIS_COLUMNS), [
      ['A1', 'ЛДСП, Дуб', '01/ЛДСП/Egger', 16, 2800, 2070, 0, 0],
    ])
    const asciiMap = encodeURIComponent(JSON.stringify(DEFAULT_BASIS_COLUMNS))
    expect([...asciiMap].every((character) => character.charCodeAt(0) < 128)).toBe(true)
    const response = await route.POST(new Request('http://localhost/api/own-catalog?format=basis-xlsx&preview=1', {
      method: 'POST', headers: { 'x-rights-confirmed': 'true', 'x-column-map': asciiMap }, body: Buffer.from(xlsx),
    }))
    expect(response.status).toBe(200)
    expect((await response.json() as { preview: { materials: unknown[] } }).preview.materials).toHaveLength(1)
  })
})
