import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-cloud-projects-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))

let auth: typeof import('../lib/server/auth')
let store: typeof import('../lib/server/store')
let route: typeof import('../app/api/projects/route')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  store = await import('../lib/server/store')
  route = await import('../app/api/projects/route')
}, 30_000)

const shop = (email: string) => {
  const result = auth.register(email, 'password123', 'Цех')
  if (!result.ok) throw new Error(result.error)
  return result.account
}

describe('бұлт жобаларының сервер дерегі', () => {
  it('ескі ревизия жаңа нұсқаны баса алмайды және өзге цех жаңарта алмайды', () => {
    const first = shop('cloud-revision-1@example.kz')
    const second = shop('cloud-revision-2@example.kz')
    const id = store.writeProject(first.shopId, 'Алғашқы', { panels: 11 })
    const revision = store.listProjects(first.shopId)[0]!.updatedAt

    const updated = store.updateProject(first.shopId, id, 'Жаңасы', { panels: 33 }, revision)
    expect(updated.kind).toBe('updated')
    expect(store.updateProject(first.shopId, id, 'Ескісі', { panels: 22 }, revision).kind).toBe('conflict')
    expect(store.readProject(first.shopId, id)).toEqual({ panels: 33 })
    expect(store.updateProject(second.shopId, id, 'Бөтен', {}, revision).kind).toBe('missing')
  })

  it('API id-пен жазғанда baseRevision талап етеді және 409 қайтарады', async () => {
    const account = shop('cloud-revision-api@example.kz')
    actor.value = { ...account, role: 'owner' }
    const { parseProjectV4, catalogOf, defaultShopProfile, findTemplate, templateToCabinet } = await import('../src/core/index')
    const catalog = catalogOf(defaultShopProfile())
    const project = parseProjectV4({ schemaVersion: 3, name: 'Шкаф',
      cabinets: [templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)], placements: [],
      room: { width: 4000, depth: 3000, height: 2700 }, materials: catalog.materials, edgeBands: catalog.edgeBands })
    const id = store.writeProject(account.shopId, project.name, project)
    const baseRevision = store.projectRevision(account.shopId, id)
    const post = (body: unknown) => route.POST(new Request('http://localhost/api/projects', {
      method: 'POST', body: JSON.stringify(body),
    }))
    expect((await post({ id, project })).status).toBe(428)
    const updated = await post({ id, project: { ...project, name: 'Жаңасы' }, baseRevision })
    expect(updated.status).toBe(200)
    expect((await post({ id, project: { ...project, name: 'Ескісі' }, baseRevision })).status).toBe(409)
    expect((store.readProject(account.shopId, id) as { name: string }).name).toBe('Жаңасы')
  })
})
