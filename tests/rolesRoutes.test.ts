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
}, 30_000)

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
    const shopProfile = { ...((await import('../src/core/index')).defaultShopProfile()),
      settings: { ...((await import('../src/core/index')).defaultShopProfile()).settings, shelfPinDatum: 64 },
      coefficient: 2.5 }
    store.writeShopProfile(owner.account.shopId, shopProfile)
    const shopResponse = await shopRoute.GET()
    expect(shopResponse.status).toBe(200)
    const shopText = await shopResponse.text()
    expect(shopText).toContain('shelfPinDatum')
    expect(shopText).toContain('64')
    expect(shopText).not.toContain('123456')
    const shopData = JSON.parse(shopText) as { profile: unknown }
    expect((shopData.profile as { coefficient: number }).coefficient).toBe(1)
    expect((await import('../src/core/index')).parseShopProfile(shopData.profile).settings.shelfPinDatum).toBe(64)
    expect((await shopRoute.PUT(new Request('http://localhost', { method: 'PUT', body: '{}' }))).status).toBe(403)
    expect((await teamRoute.GET()).status).toBe(200)
  })

  it('designer өз командасын оқиды және өзі шығады, бірақ шақыру жасай алмайды', async () => {
    const team = await import('../lib/server/team')
    const owner = auth.register('routes-team-owner@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    const joined = auth.register('routes-team-designer@example.kz', 'password123', '', owner.account.shopId)
    if (!joined.ok) throw new Error(joined.error)
    team.createInvite(owner.account.shopId, owner.account.userId)
    actor.value = joined.account
    const listed = await teamRoute.GET()
    expect(listed.status).toBe(200)
    const data = await listed.json() as { members: { userId: string }[]; invites: unknown[] }
    expect(data.members.map((member) => member.userId)).toEqual([owner.account.userId, joined.account.userId])
    expect(data.invites).toEqual([])
    expect((await teamRoute.POST(new Request('http://localhost', { method: 'POST', body: '{}' }))).status).toBe(403)
    const left = await memberRoute.DELETE(new Request('http://localhost', { method: 'DELETE',
      body: JSON.stringify({ userId: joined.account.userId }) }))
    expect(left.status).toBe(200)
    expect(team.listMembers(owner.account.shopId).map((member) => member.userId)).toEqual([owner.account.userId])
  })

  it('owner емес адам рөл ауыстыра, шақыруды қайтара алмайды; shop inbox оқи, share жасай алмайды', async () => {
    const team = await import('../lib/server/team')
    const owner = auth.register('routes-escalate-owner@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    const worker = auth.register('routes-escalate-shop@example.kz', 'password123', '', owner.account.shopId, 'shop')
    const designer = auth.register('routes-escalate-designer@example.kz', 'password123', '', owner.account.shopId)
    if (!worker.ok || !designer.ok) throw new Error('registration failed')
    const invite = team.createInvite(owner.account.shopId, owner.account.userId)
    const roleOf = (userId: string) => team.listMembers(owner.account.shopId).find((m) => m.userId === userId)?.role

    // shop өзін designer етіп, ішкі бағаға қол жеткізбеуі керек.
    actor.value = worker.account
    const escalate = await memberRoute.PATCH(new Request('http://localhost', { method: 'PATCH',
      body: JSON.stringify({ userId: worker.account.userId, role: 'designer' }) }))
    expect(escalate.status).toBe(403)
    expect(roleOf(worker.account.userId)).toBe('shop')
    expect((await replyRoute.GET()).status).toBe(403)
    const { catalogOf, defaultShopProfile, findTemplate, templateToCabinet } = await import('../src/core/index')
    const catalog = catalogOf(defaultShopProfile())
    const project = JSON.stringify({ name: 'Ж', schemaVersion: 3, placements: [],
      cabinets: [templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)],
      room: { width: 4000, depth: 3000, height: 2700 }, materials: catalog.materials, edgeBands: catalog.edgeBands })
    expect((await shareRoute.POST(new Request('http://localhost', { method: 'POST', body: project }))).status).toBe(403)

    // designer басқаның рөлін өзгертпейді және owner шақыруын қайтармайды.
    actor.value = designer.account
    const demote = await memberRoute.PATCH(new Request('http://localhost', { method: 'PATCH',
      body: JSON.stringify({ userId: worker.account.userId, role: 'designer' }) }))
    expect(demote.status).toBe(403)
    expect(roleOf(worker.account.userId)).toBe('shop')
    const revoke = await teamRoute.DELETE(new Request('http://localhost', { method: 'DELETE',
      body: JSON.stringify({ token: invite.token }) }))
    expect(revoke.status).toBe(403)
    expect(team.checkInvite(invite.token).ok).toBe(true)
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

  it('цех share-ін ескі кілті бар шығарылған адам өзгерте не автор болып жауап бере алмайды', async () => {
    const owner = auth.register('share-key-owner@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    const created = share.createShare('{}', Date.now(), owner.account.shopId)
    const posted = await commentRoute.POST(new Request('http://localhost', { method: 'POST',
      body: JSON.stringify({ body: 'Сұрақ', author: 'Клиент', targetId: null }) }), context(created.code))
    const { comment } = await posted.json() as { comment: { id: string } }
    actor.value = null
    const reply = await replyRoute.POST(new Request('http://localhost', { method: 'POST',
      headers: { 'x-share-key': created.key },
      body: JSON.stringify({ code: created.code, replyTo: comment.id, body: 'Жалған автор' }) }))
    expect(reply.status).toBe(401)
    const put = await sharedRoute.PUT(new Request('http://localhost', { method: 'PUT',
      headers: { 'x-share-key': created.key }, body: '{}' }), context(created.code))
    expect(put.status).toBe(401)
    expect(share.readShare(created.code)?.json).toBe('{}')
  })

  it('аноним share авторы кіргеннен кейін де өз кілтімен жауап береді', async () => {
    const owner = auth.register('anonymous-login@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    const created = share.createShare('{}')
    const posted = await commentRoute.POST(new Request('http://localhost', { method: 'POST',
      body: JSON.stringify({ body: 'Сұрақ', author: 'Клиент', targetId: null }) }), context(created.code))
    const { comment } = await posted.json() as { comment: { id: string } }
    actor.value = owner.account
    const reply = await replyRoute.POST(new Request('http://localhost', { method: 'POST',
      headers: { 'x-share-key': created.key },
      body: JSON.stringify({ code: created.code, replyTo: comment.id, body: 'Жауап' }) }))
    expect(reply.status).toBe(201)
    expect((await reply.json() as { comment: { authorRole: string } }).comment.authorRole).toBe('creator')
  })

  it('20 қате кодтан кейін бір IP 429 алады, өзге IP әсерленбейді', async () => {
    actor.value = null
    for (let index = 0; index < 20; index += 1) {
      const response = await sharedRoute.GET(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.15' } }), context(`invalid-${index}`))
      expect(response.status).toBe(404)
    }
    const blocked = await sharedRoute.GET(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.15' } }), context('invalid-next'))
    expect(blocked.status).toBe(429)
    const spoofed = await sharedRoute.GET(new Request('http://localhost', { headers: {
      'x-real-ip': '192.0.2.15', 'x-forwarded-for': '203.0.113.99',
    } }), context('invalid-next'))
    expect(spoofed.status).toBe(429)
    const other = await sharedRoute.GET(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.16' } }), context('invalid-next'))
    expect(other.status).toBe(404)
  })

  it('лимиттегі IP бар кодты да ала алмайды (200/429 арқылы кодты табу жабық), бір кодқа 5 қате', async () => {
    actor.value = null
    const code = share.createShare('{}').code
    const get = (target: string) => sharedRoute.GET(new Request('http://localhost',
      { headers: { 'x-real-ip': '192.0.2.40' } }), context(target))
    for (let index = 0; index < 20; index += 1) expect((await get(`gate-${index}`)).status).toBe(404)
    expect((await get(code)).status).toBe(429)
    expect((await commentRoute.GET(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.40' } }), context(code))).status).toBe(429)
    const same = () => sharedRoute.GET(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.41' } }), context('000000'))
    for (let index = 0; index < 5; index += 1) expect((await same()).status).toBe(404)
    expect((await same()).status).toBe(429)
  })

  it('бір IP бір share-ге минутына 5 пікірден артық жаза алмайды', async () => {
    const code = share.createShare('{}').code
    const request = () => new Request('http://localhost', { method: 'POST', headers: { 'x-real-ip': '192.0.2.20' },
      body: JSON.stringify({ body: 'Пікір', author: 'Клиент', targetId: null }) })
    for (let index = 0; index < 5; index += 1) {
      expect((await commentRoute.POST(request(), context(code))).status).toBe(201)
    }
    expect((await commentRoute.POST(request(), context(code))).status).toBe(429)
  })

  it('қатар келген қате код сұраулары лимитті аттап өте алмайды', async () => {
    const responses = await Promise.all(Array.from({ length: 30 }, (_, index) =>
      sharedRoute.GET(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.30' } }),
        context(`parallel-${index}`))))
    expect(responses.filter((response) => response.status === 404)).toHaveLength(20)
    expect(responses.filter((response) => response.status === 429)).toHaveLength(10)
  })

  it('share жасау және жаңарту v4 ағаш жобасын сақтайды', async () => {
    const owner = auth.register('share-v4-owner@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    const { parseProjectV4, catalogOf, defaultShopProfile, findTemplate, templateToCabinet } = await import('../src/core/index')
    const catalog = catalogOf(defaultShopProfile())
    const project = parseProjectV4({ schemaVersion: 3, name: 'v4',
      cabinets: [templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)], placements: [],
      room: { width: 4000, depth: 3000, height: 2700 }, materials: catalog.materials, edgeBands: catalog.edgeBands })
    const create = await shareRoute.POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(project) }))
    expect(create.status).toBe(200)
    const { code } = await create.json() as { code: string; key: string }
    const next = { ...project, name: 'v4 өзгерді' }
    const updated = await sharedRoute.PUT(new Request('http://localhost', { method: 'PUT',
      body: JSON.stringify(next) }), context(code))
    expect(updated.status).toBe(200)
    const got = await sharedRoute.GET(new Request('http://localhost'), context(code))
    expect((await got.json() as { project: { schemaVersion: number; name: string; root: unknown } }).project)
      .toMatchObject({ schemaVersion: 4, name: 'v4 өзгерді' })
  })
})
