import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SEED_CATALOG, findTemplate, templateToCabinet } from '../src/core/index'
import { isApprovalClockError } from '../lib/server/approvalErrors'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-approval-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' | 'designer' | 'shop' | 'client' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))

let auth: typeof import('../lib/server/auth')
let share: typeof import('../lib/server/share')
let route: typeof import('../app/api/share/[code]/approval/route')
let database: typeof import('../lib/server/db')
const context = (code: string) => ({ params: Promise.resolve({ code }) })
const req = (method: string, body?: unknown) => new Request('http://localhost/api/share/x/approval', {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const project = (name = 'Шкаф', price = 12500000) => ({
  schemaVersion: 3, name, cabinets: [templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)], placements: [],
  room: { width: 4000, depth: 3000, height: 2700 },
  materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands,
  priceOverrides: { salePrice: price },
})

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  share = await import('../lib/server/share')
  route = await import('../app/api/share/[code]/approval/route')
  database = await import('../lib/server/db')
})

describe('share келісім API', () => {
  it('цех ашады, клиент бөлек кодпен растайды, ескі мөр өзгермейді', async () => {
    const owner = auth.register('approval@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    const s = share.createShare(JSON.stringify(project()), Date.now(), owner.account.shopId)
    const previewPngBase64 = readFileSync(join(process.cwd(), 'public/icon-192.png')).toString('base64')
    const started = await route.POST(req('POST', { previewPngBase64 }), context(s.code))
    if (started.status !== 201) throw new Error(`start ${started.status}: ${await started.text()}`)
    expect(started.status).toBe(201)
    const challenge = await started.json() as { version: number; hash: string; confirmationCode: string; priceMinor: number }
    expect(challenge.version).toBe(1)
    expect(challenge.priceMinor).toBe(12500000)
    expect(challenge.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(challenge.confirmationCode).toMatch(/^\d{6}$/)
    actor.value = null
    expect((await route.PUT(req('PUT', { confirmationCode: '000000' }), context(s.code))).status).toBe(403)
    const confirmed = await route.PUT(req('PUT', { confirmationCode: challenge.confirmationCode }), context(s.code))
    expect(confirmed.status).toBe(200)
    const seal = await confirmed.json() as { seal: { hash: string; priceMinor: number; confirmationCode: string } }
    expect(seal.seal).toMatchObject({ hash: challenge.hash, priceMinor: 12500000, confirmationCode: challenge.confirmationCode })
    expect((await route.PUT(req('PUT', { confirmationCode: challenge.confirmationCode }), context(s.code))).status).toBe(409)
    const got = await route.GET(req('GET'), context(s.code))
    expect((await got.json() as { seal: unknown }).seal).toEqual(seal.seal)
    const pdf = await route.GET(new Request('http://localhost/api/share/x/approval?format=pdf'), context(s.code))
    expect(pdf.status).toBe(200)
    expect(pdf.headers.get('content-type')).toMatch(/application\/pdf/)
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe('%PDF-')

    actor.value = owner.account
    expect(share.updateShare(s.code, s.key, JSON.stringify(project('Жаңа')), Date.now(), owner.account.shopId)).toBe(true)
    const stale = await route.GET(req('GET'), context(s.code))
    expect(await stale.json()).toMatchObject({ status: 'changed', latestApprovedVersion: 1 })
    const renewed = await route.POST(req('POST', {}), context(s.code))
    expect(renewed.status).toBe(201)
    expect((await renewed.json() as { version: number }).version).toBe(2)
    const old = await route.GET(new Request('http://localhost/api/share/x/approval?version=1'), context(s.code))
    expect((await old.json() as { seal: { hash: string } }).seal.hash).toBe(challenge.hash)
    const current = await route.GET(req('GET'), context(s.code))
    expect(await current.json()).toMatchObject({ status: 'pending', latestApprovedVersion: 1 })
  })

  it('қате баға, жарамсыз сұраныс және рұқсат 4xx болып шығады', async () => {
    const owner = auth.register('approval-errors@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    const s = share.createShare(JSON.stringify(project('Бағасыз', -1)), Date.now(), owner.account.shopId)
    actor.value = null
    expect((await route.POST(req('POST', {}), context(s.code))).status).toBe(401)
    actor.value = { ...owner.account, role: 'shop' }
    expect((await route.POST(req('POST', {}), context(s.code))).status).toBe(403)
    actor.value = owner.account
    expect((await route.POST(req('POST', {}), context(s.code))).status).toBe(422)
    expect((await route.POST(new Request('http://localhost', { method: 'POST', body: '{' }), context(s.code))).status).toBe(400)
    const valid = share.createShare(JSON.stringify(project('PNG')), Date.now(), owner.account.shopId)
    expect((await route.POST(req('POST', { previewPngBase64: 'not-png' }), context(valid.code))).status).toBe(400)
    const missing = await route.GET(req('GET'), context('bad-code'))
    expect(missing.status).toBe(404)
    expect(await missing.text()).not.toMatch(/stack|node_modules|\/home\//i)
  })

  it('жоба өзгергенде ескі растау коды өтпейді; жаңа нұсқа ашылады', async () => {
    const owner = auth.register('approval-changed@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    const s = share.createShare(JSON.stringify(project('Алғашқы')), Date.now(), owner.account.shopId)
    const started = await route.POST(req('POST', {}), context(s.code))
    expect(started.status).toBe(201)
    const first = await started.json() as { version: number; confirmationCode: string }
    share.updateShare(s.code, s.key, JSON.stringify(project('Өзгерген')), Date.now(), owner.account.shopId)
    actor.value = null
    expect((await route.PUT(req('PUT', { confirmationCode: first.confirmationCode }), context(s.code))).status).toBe(409)
    actor.value = owner.account
    const next = await route.POST(req('POST', {}), context(s.code))
    expect(next.status).toBe(201)
    expect((await next.json() as { version: number }).version).toBe(first.version + 1)
  })

  it('сервер сағаты нұсқа уақытынан кері кетсе 409 қайтарады', async () => {
    expect(isApprovalClockError(new Error('УАҚЫТ ЖАРАМСЫЗ'))).toBe(true)
    const owner = auth.register('approval-clock@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    const s = share.createShare(JSON.stringify(project('Сағат')), Date.now() - 1000, owner.account.shopId)
    const started = await route.POST(req('POST', {}), context(s.code))
    expect(started.status).toBe(201)
    const { confirmationCode } = await started.json() as { confirmationCode: string }
    const created = database.db().prepare('SELECT created_at FROM approval_revisions WHERE share_code = ?')
      .get(s.code) as { created_at: number }
    actor.value = null
    const clock = vi.spyOn(Date, 'now').mockReturnValue(created.created_at - 1)
    try {
      const response = await route.PUT(req('PUT', { confirmationCode }), context(s.code))
      expect(response.status).toBe(409)
      expect(await response.text()).toMatch(/уақыт жарамсыз/i)
    } finally { clock.mockRestore() }
  })

  it('бүлінген серверлік снимок 500 береді, стек клиентке шықпайды', async () => {
    const owner = auth.register('approval-500@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    const s = share.createShare(JSON.stringify(project('500 тест')), Date.now(), owner.account.shopId)
    const started = await route.POST(req('POST', {}), context(s.code))
    expect(started.status).toBe(201)
    const { confirmationCode } = await started.json() as { confirmationCode: string }
    actor.value = null
    expect((await route.PUT(req('PUT', { confirmationCode }), context(s.code))).status).toBe(200)
    database.db().prepare("UPDATE approval_revisions SET project_json = '{' WHERE share_code = ?").run(s.code)
    const response = await route.GET(new Request('http://localhost/api/share/x/approval?format=pdf'), context(s.code))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toMatch(/stack|node_modules|\/home\//i)
  })
})
