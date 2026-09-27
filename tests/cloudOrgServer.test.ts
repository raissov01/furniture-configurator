import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, expect, it, vi } from 'vitest'
import { addCloudFolder, moveProjectToFolder, parseCloudOrg } from '../src/core/cloudProjectOrganize'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-cloud-org-'))
const actor = vi.hoisted(() => ({ value: null as { userId: string; shopId: string; role: 'owner' } | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))

let auth: typeof import('../lib/server/auth')
let route: typeof import('../app/api/projects/organize/route')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  route = await import('../app/api/projects/organize/route')
}, 30_000)

it('папка мен сұрыптау серверде сақталады және басқа аккаунтқа көрінбейді', async () => {
  const first = auth.register('cloud-org-a@example.kz', 'password123', 'Цех')
  const second = auth.register('cloud-org-b@example.kz', 'password123', 'Цех')
  if (!first.ok || !second.ok) throw new Error('Тіркеу қатесі')
  actor.value = { ...first.account, role: 'owner' }
  const original = moveProjectToFolder(addCloudFolder(parseCloudOrg(null), 'Шкафтар'), 'project-1', 'Шкафтар')
  const org = { ...original, sort: 'name' as const }
  const saved = await route.PUT(new Request('http://localhost/api/projects/organize', {
    method: 'PUT', body: JSON.stringify({ org }),
  }))
  expect(saved.status).toBe(200)
  expect(await route.GET()).toMatchObject({ status: 200 })
  expect(await (await route.GET()).json()).toEqual({ org })
  actor.value = { ...second.account, role: 'owner' }
  expect(await (await route.GET()).json()).toEqual({ org: null })
  const invalid = await route.PUT(new Request('http://localhost/api/projects/organize', {
    method: 'PUT', body: JSON.stringify({ org: { ...org, sort: 'oops' } }),
  }))
  expect(invalid.status).toBe(400)
})
