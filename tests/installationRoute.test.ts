import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SEED_CATALOG, findTemplate, templateToCabinet } from '../src/core/index'
import { parseProjectV4 } from '../src/core/projectV4'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-installation-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' | 'designer' | 'shop' | 'client' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))

let auth: typeof import('../lib/server/auth')
let store: typeof import('../lib/server/store')
let database: typeof import('../lib/server/db')
let route: typeof import('../app/api/installation/[id]/route')
let sync: typeof import('../app/api/installation/sync/route')
let list: typeof import('../app/api/installation/route')
const context = (id: string) => ({ params: Promise.resolve({ id }) })
const request = (body: unknown) => new Request('http://localhost/api/installation/sync', { method: 'POST', body: JSON.stringify(body) })
const project = () => {
  const migrated = parseProjectV4({
  schemaVersion: 3, name: 'Шкаф', cabinets: [templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)], placements: [],
  room: { width: 4000, depth: 3000, height: 2700 }, materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands,
  })
  migrated.root.children[0]!.hidden = false
  return migrated
}
const action = (id: string, kind: string, entityId: string, payload: unknown, version: number, updatedAt = 0) => ({
  id, kind, entityId, payload, baseRevision: { version, updatedAt }, createdAt: Date.now(),
})

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  store = await import('../lib/server/store')
  database = await import('../lib/server/db')
  route = await import('../app/api/installation/[id]/route')
  sync = await import('../app/api/installation/sync/route')
  list = await import('../app/api/installation/route')
})

describe('монтаж API және офлайн кезек', () => {
  it('рөлдер, қайталау, қайшылық, деталь және төлем outbox-ы', async () => {
    const owner = auth.register('install-owner@example.kz', 'password123', 'Цех монтаж')
    const outsider = auth.register('install-other@example.kz', 'password123', 'Басқа цех')
    if (!owner.ok || !outsider.ok) throw new Error('Тіркелу сәтсіз')
    const projectId = store.writeProject(owner.account.shopId, 'Шкаф', project())
    const create = action('create-1', 'installation.create', 'install-1', { projectId }, 0)
    actor.value = null
    expect((await sync.POST(request(create))).status).toBe(401)
    actor.value = { ...owner.account, role: 'client' }
    expect((await sync.POST(request(create))).status).toBe(403)
    actor.value = { ...owner.account, role: 'shop' }
    const created = await sync.POST(request(create))
    expect(created.status).toBe(200)
    const createdBody = await created.json() as { kind: string; revision: { version: number; updatedAt: number } }
    expect(createdBody).toMatchObject({ kind: 'applied', revision: { version: 1 } })
    expect(await (await sync.POST(request(create))).json()).toMatchObject({ kind: 'duplicate', revision: { version: 1 } })
    expect((await sync.POST(request({ ...create, payload: { projectId: 'wrong' } }))).status).toBe(409)
    actor.value = outsider.account
    expect((await route.GET(new Request('http://localhost'), context('install-1'))).status).toBe(404)
    expect((await (await list.GET()).json() as { tasks: unknown[] }).tasks).toEqual([])
    expect((await sync.POST(request(action('other', 'installation.close', 'install-1', {}, 1)))).status).toBe(404)
    actor.value = { ...owner.account, role: 'shop' }
    expect((await (await list.GET()).json() as { tasks: { id: string }[] }).tasks[0]?.id).toBe('install-1')
    const got = await route.GET(new Request('http://localhost'), context('install-1'))
    expect(got.status).toBe(200)
    const task = (await got.json() as { task: { panelIds: string[] } }).task
    expect(task.panelIds.length).toBeGreaterThan(0)
    const badPanel = action('defect-bad', 'installation.defect', 'install-1',
      { id: 'defect-1', panelId: 'not-a-panel', note: 'Сызат', photo: { id: 'p', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' } }, 1, createdBody.revision.updatedAt)
    expect((await sync.POST(request(badPanel))).status).toBe(422)
    const defect = { ...badPanel, id: 'defect-good', payload: { ...badPanel.payload as object, panelId: task.panelIds[0] } }
    const applied = await sync.POST(request(defect))
    expect(applied.status).toBe(200)
    expect(await applied.json()).toMatchObject({ kind: 'applied', revision: { version: 2 } })
    const conflict = await sync.POST(request(action('stale', 'installation.close', 'install-1', {}, 1)))
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toMatchObject({ kind: 'conflict', revision: { version: 2 } })
    expect(database.db().prepare('SELECT count(*) AS n FROM installation_events').get()).toMatchObject({ n: 0 })
  })

  it('жабуды сервер тексереді және соңғы төлем оқиғасы бір рет жазылады', async () => {
    const owner = auth.register('install-close@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = { ...owner.account, role: 'shop' }
    const projectId = store.writeProject(owner.account.shopId, 'Шкаф', project())
    const taskId = 'install-close'
    let revision = (await (await sync.POST(request(action('close-create', 'installation.create', taskId, { projectId }, 0)))).json() as
      { revision: { version: number; updatedAt: number } }).revision
    const premature = await sync.POST(request(action('close-early', 'installation.close', taskId, {}, revision.version, revision.updatedAt)))
    expect(premature.status).toBe(422)
    const photo = { id: 'photo', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' }
    for (const key of ['delivery', 'assembly', 'alignment', 'cleaning', 'acceptance']) {
      const result = await sync.POST(request(action(`check-${key}`, 'installation.checklist', taskId,
        { key, checked: true, photo }, revision.version, revision.updatedAt)))
      expect(result.status).toBe(200)
      revision = (await result.json() as { revision: typeof revision }).revision
    }
    const signed = await sync.POST(request(action('sign', 'installation.signature', taskId,
      { signature: { id: 'sign-image', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' } },
      revision.version, revision.updatedAt)))
    expect(signed.status).toBe(200)
    revision = (await signed.json() as { revision: typeof revision }).revision
    const closeAction = action('close-final', 'installation.close', taskId, {}, revision.version, revision.updatedAt)
    const closed = await sync.POST(request(closeAction))
    expect(closed.status).toBe(200)
    expect(await (await sync.POST(request(closeAction))).json()).toMatchObject({ kind: 'duplicate' })
    expect(database.db().prepare('SELECT count(*) AS n FROM installation_events WHERE task_id = ?').get(taskId)).toMatchObject({ n: 1 })
    expect((await (await route.GET(new Request('http://localhost'), context(taskId))).json() as { task: { status: string } }).task.status).toBe('closed')
  })

  it('басқа цехтың тапсырма ID-і 500 емес, 409 береді және оның тапсырмасын өзгертпейді', async () => {
    const first = auth.register('install-id-a@example.kz', 'password123', 'Цех А')
    const second = auth.register('install-id-b@example.kz', 'password123', 'Цех Б')
    if (!first.ok || !second.ok) throw new Error('Тіркелу сәтсіз')
    actor.value = { ...first.account, role: 'shop' }
    const firstProject = store.writeProject(first.account.shopId, 'Шкаф', project())
    expect((await sync.POST(request(action('id-a', 'installation.create', 'shared-install', { projectId: firstProject }, 0)))).status).toBe(200)
    actor.value = { ...second.account, role: 'shop' }
    const secondProject = store.writeProject(second.account.shopId, 'Шкаф', project())
    const clash = await sync.POST(request(action('id-b', 'installation.create', 'shared-install', { projectId: secondProject }, 0)))
    expect(clash.status).toBe(409)
    actor.value = { ...first.account, role: 'shop' }
    const kept = await (await route.GET(new Request('http://localhost'), context('shared-install'))).json() as { task: { projectId: string } }
    expect(kept.task.projectId).toBe(firstProject)
  })

  it('4xx/500 жауаптар стек бермейді', async () => {
    const owner = auth.register('install-error@example.kz', 'password123', 'Цех')
    if (!owner.ok) throw new Error(owner.error)
    actor.value = owner.account
    expect((await sync.POST(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400)
    expect((await sync.POST(request(action('missing', 'installation.create', 'new-install', { projectId: 'no-project' }, 0)))).status).toBe(404)
    const projectId = store.writeProject(owner.account.shopId, 'Шкаф', project())
    expect((await sync.POST(request(action('bad-version', 'installation.create', 'bad-install', { projectId }, 3)))).status).toBe(409)
    expect((await sync.POST(request(action('create-error', 'installation.create', 'error-install', { projectId }, 0)))).status).toBe(200)
    database.db().prepare("UPDATE installation_tasks SET json = '{' WHERE id = ?").run('error-install')
    const syncResponse = await sync.POST(request(action('corrupt', 'installation.close', 'error-install', {}, 1)))
    expect(syncResponse.status).toBe(500)
    expect(await syncResponse.text()).not.toMatch(/stack|node_modules|\/home\//i)
    const response = await route.GET(new Request('http://localhost'), context('error-install'))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toMatch(/stack|node_modules|\/home\//i)
  })
})
