import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createMeasurementSyncAction, OBSTACLE_KINDS } from '../src/core/measure'
import type { MeasurementSurvey } from '../src/core/measure'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-mobile-measure-routes-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' | 'designer' | 'shop' | 'client' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))

let auth: typeof import('../lib/server/auth')
let photos: typeof import('../app/api/mobile/photos/[id]/route')
let sync: typeof import('../app/api/mobile/measure/sync/route')
const params = (id: string) => ({ params: Promise.resolve({ id }) })
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

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  photos = await import('../app/api/mobile/photos/[id]/route')
  sync = await import('../app/api/mobile/measure/sync/route')
})

describe('мобильді өлшем API', () => {
  it('рөл мен цех шекарасын тексереді; фото және әрекет қайталанса нұсқа өспейді', async () => {
    const owner = auth.register('mobile-route-owner@example.kz', 'password123', 'Цех мобильді')
    const outsider = auth.register('mobile-route-other@example.kz', 'password123', 'Басқа цех')
    if (!owner.ok || !outsider.ok) throw new Error('Тіркелу сәтсіз')
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const photoRequest = () => new Request('http://localhost/api/mobile/photos/photo-1', {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: image,
    })
    actor.value = null
    expect((await photos.POST(photoRequest(), params('photo-1'))).status).toBe(401)
    actor.value = { ...owner.account, role: 'client' }
    expect((await photos.POST(photoRequest(), params('photo-1'))).status).toBe(403)
    actor.value = { ...owner.account, role: 'designer' }
    expect((await photos.POST(photoRequest(), params('photo-1'))).status).toBe(200)
    expect((await (await photos.POST(photoRequest(), params('photo-1'))).json())).toMatchObject({ kind: 'duplicate' })
    const action = createMeasurementSyncAction(survey(), 'action-1', { version: 0, updatedAt: 0 }, 1000)
    const request = () => new Request('http://localhost/api/mobile/measure/sync', { method: 'POST', body: JSON.stringify(action) })
    const applied = await sync.POST(request())
    expect(applied.status).toBe(200)
    expect(await applied.json()).toMatchObject({ kind: 'applied', revision: { version: 1 } })
    expect(await (await sync.POST(request())).json()).toMatchObject({ kind: 'duplicate', revision: { version: 1 } })
    actor.value = outsider.account
    expect((await photos.GET(new Request('http://localhost'), params('photo-1'))).status).toBe(404)
    expect((await sync.POST(request())).status).toBe(422)
  })
})
