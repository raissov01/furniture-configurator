import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-role-routes-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' | 'designer' | 'shop' | 'client' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))

let auth: typeof import('../lib/server/auth')
let share: typeof import('../lib/server/share')
let store: typeof import('../lib/server/store')
let commentRoute: typeof import('../app/api/share/[code]/comments/route')
let replyRoute: typeof import('../app/api/comments/route')
let projectRoute: typeof import('../app/api/projects/[id]/route')
let projectsRoute: typeof import('../app/api/projects/route')
let shareRoute: typeof import('../app/api/share/route')
let sharedRoute: typeof import('../app/api/share/[code]/route')
let teamRoute: typeof import('../app/api/team/route')
let memberRoute: typeof import('../app/api/team/member/route')
let shopRoute: typeof import('../app/api/shop/route')

const context = (code: string) => ({ params: Promise.resolve({ code }) })

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  share = await import('../lib/server/share')
  store = await import('../lib/server/store')
  commentRoute = await import('../app/api/share/[code]/comments/route')
  replyRoute = await import('../app/api/comments/route')
  projectRoute = await import('../app/api/projects/[id]/route')
  projectsRoute = await import('../app/api/projects/route')
  shareRoute = await import('../app/api/share/route')
  sharedRoute = await import('../app/api/share/[code]/route')
  teamRoute = await import('../app/api/team/route')
  memberRoute = await import('../app/api/team/member/route')
  shopRoute = await import('../app/api/shop/route')
})

describe('маршруттарда permission және 4xx', () => {
  it('бұрыс JSON, бос дене, үлкен мәтін 4xx, traceback шықпайды', async () => {
    const code = share.createShare('{}').code
    for (const body of ['{', '', JSON.stringify({ author: 'A', body: 'x'.repeat(3000), targetId: null })]) {
      const response = await commentRoute.POST(new Request('http://localhost', { method: 'POST', body }), context(code))
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
      expect(await response.text()).not.toMatch(/stack|node_modules|\/home\//i)
    }
  })

  it('shop жауап бере алмайды; клиент есімі designer болса да рөлі client', async () => {
    const owner = auth.register('routes-owner@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    const code = share.createShare('{}', Date.now(), owner.account.shopId).code
    const posted = await commentRoute.POST(new Request('http://localhost', { method: 'POST',
      body: JSON.stringify({ body: 'Сұрақ', author: 'designer', targetId: null }) }), context(code))
    expect(posted.status).toBe(201)
    const data = await posted.json() as { comment: { id: string; authorRole: string } }
    expect(data.comment.authorRole).toBe('client')
    const forged = await commentRoute.POST(new Request('http://localhost', { method: 'POST',
      body: JSON.stringify({ body: 'spoof', author: 'designer', targetId: null, authorRole: 'designer' }) }), context(code))
    expect(forged.status).toBe(400)
    const missingObject = await commentRoute.POST(new Request('http://localhost', { method: 'POST',
      body: JSON.stringify({ body: 'spoof', author: 'designer', targetId: 'not-here' }) }), context(code))
    expect(missingObject.status).toBe(400)
    actor.value = { userId: owner.account.userId, shopId: owner.account.shopId, role: 'shop' }
    const denied = await replyRoute.POST(new Request('http://localhost', { method: 'POST',
      body: JSON.stringify({ code, replyTo: data.comment.id, body: 'Жауап' }) }))
    expect(denied.status).toBe(403)
  })

  it('shop project GET ішкі бағаны өшіреді, DELETE тыйылады', async () => {
    const owner = auth.register('routes-project@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    const id = store.writeProject(owner.account.shopId, 'Жоба', {
      name: 'Жоба', schemaVersion: 3, cabinets: [], placements: [], room: { width: 4000, depth: 3000, height: 2700 },
      materials: [{ id: 'm', name: 'Материал', thickness: 16, sheetWidth: 2800, sheetHeight: 2070, hasGrain: false, trimEdge: 10, pricePerSheet: 123456 }],
      edgeBands: [{ id: 'e', name: 'Кромка', thickness: 2, pricePerMeter: 789 }],
      priceOverrides: { coefficient: 1.7, salePrice: 1230000 },
    })
    actor.value = { userId: owner.account.userId, shopId: owner.account.shopId, role: 'shop' }
    const projectContext = { params: Promise.resolve({ id }) }
    const got = await projectRoute.GET(new Request('http://localhost'), projectContext)
    expect(got.status).toBe(200)
    const text = await got.text()
    expect(text).not.toContain('123456')
    expect(text).not.toContain('coefficient')
    expect((await projectRoute.DELETE(new Request('http://localhost', { method: 'DELETE' }), projectContext)).status).toBe(403)
    expect((await projectsRoute.POST(new Request('http://localhost', { method: 'POST', body: '{}' }))).status).toBe(403)
    expect((await shopRoute.GET()).status).toBe(403)
    expect((await shopRoute.PUT(new Request('http://localhost', { method: 'PUT', body: '{}' }))).status).toBe(403)
    expect((await teamRoute.GET()).status).toBe(403)
  })

  it('share, project, team қате сұраныстары 4xx және таза жауап қайтарады', async () => {
    const owner = auth.register('routes-bad@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    const code = share.createShare('{}').code
    const bad = new Request('http://localhost', { method: 'POST', body: '{' })
    const responses = [
      await shareRoute.POST(bad.clone()),
      await projectsRoute.POST(bad.clone()),
      await teamRoute.POST(new Request('http://localhost', { method: 'POST', body: '{' })),
      await memberRoute.PATCH(new Request('http://localhost', { method: 'PATCH', body: '{' })),
      await sharedRoute.PUT(new Request('http://localhost', { method: 'PUT', body: '{' }), context(code)),
    ]
    for (const response of responses) {
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
      expect(await response.text()).not.toMatch(/stack|node_modules|\/home\//i)
    }
  })
})
