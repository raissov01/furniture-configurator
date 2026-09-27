import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, expect, it } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-cloud-list-'))
let auth: typeof import('../lib/server/auth')
let store: typeof import('../lib/server/store')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  store = await import('../lib/server/store')
}, 30_000)

it('101-жоба түгел көрінеді; беттеу, іздеу және жалпы сан жұмыс істейді', () => {
  const result = auth.register('cloud-list-101@example.kz', 'password123', 'Цех')
  if (!result.ok) throw new Error(result.error)
  const shopId = result.account.shopId
  const ids = Array.from({ length: 101 }, (_, i) => store.writeProject(shopId, `Жоба ${i}`, {}))
  expect(store.listProjects(shopId)).toHaveLength(101)
  const first = store.listProjectsPage(shopId, { limit: 100, offset: 0 })
  const last = store.listProjectsPage(shopId, { limit: 100, offset: 100 })
  expect(first.total).toBe(101)
  expect(first.projects).toHaveLength(100)
  expect(last.projects).toHaveLength(1)
  expect(new Set([...first.projects, ...last.projects].map((row) => row.id))).toEqual(new Set(ids))
  const found = store.listProjectsPage(shopId, { limit: 20, offset: 0, query: 'Жоба 100' })
  expect(found.total).toBe(1)
  expect(found.projects.map((row) => row.id)).toEqual([ids[100]])
})
