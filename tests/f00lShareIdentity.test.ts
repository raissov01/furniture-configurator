import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defaultShopProfile, findTemplate, SEED_CATALOG, templateToCabinet } from '@/src/core/index'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'f00l-share-identity-'))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))

let share: typeof import('@/lib/server/share')
let store: typeof import('@/lib/server/store')
let auth: typeof import('@/lib/server/auth')
let route: typeof import('@/app/api/share/[code]/route')

beforeAll(async () => {
  share = await import('@/lib/server/share')
  store = await import('@/lib/server/store')
  auth = await import('@/lib/server/auth')
  route = await import('@/app/api/share/[code]/route')
})

describe('public share identity', () => {
  it('returns the sending shop and project without exposing the shop profile', async () => {
    const owner = auth.register('f00l-owner@example.kz', 'password123', 'Алаш')
    if (!owner.ok) throw new Error(owner.error)
    const shopId = owner.account.shopId
    const profile = { ...defaultShopProfile(shopId), name: 'Алаш', phone: '+7 777 123 45 67',
      logoDataUrl: 'data:image/png;base64,AA==' }
    store.writeShopProfile(shopId, profile)
    const project = { schemaVersion: 3, name: 'Клиент шкафы',
      cabinets: [templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)], placements: [],
      room: { width: 4000, depth: 3000, height: 2700 },
      materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands }
    const { code } = share.createShare(JSON.stringify(project), Date.now(), shopId)
    const response = await route.GET(new Request(`http://localhost/api/share/${code}`), { params: Promise.resolve({ code }) })
    expect(response.status).toBe(200)
    const data = await response.json() as { project: { name: string }; shop: Record<string, unknown> }
    expect(data.project.name).toBe('Клиент шкафы')
    expect(data.shop).toEqual({ name: 'Алаш', phone: '+7 777 123 45 67',
      logoDataUrl: 'data:image/png;base64,AA==', whatsappUrl: 'https://wa.me/77771234567' })
    expect(JSON.stringify(data.shop)).not.toContain('materials')
  })
})
