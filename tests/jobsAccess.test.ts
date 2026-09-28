import { afterAll, describe, expect, it, vi } from 'vitest'

const actor = vi.hoisted(() => ({ role: 'client' as 'client' | 'designer' }))
const queued = vi.hoisted(() => ({ count: 0 }))
const previousDatabaseUrl = process.env['DATABASE_URL']
afterAll(() => {
  if (previousDatabaseUrl === undefined) delete process.env['DATABASE_URL']
  else process.env['DATABASE_URL'] = previousDatabaseUrl
})
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => ({ role: actor.role, shopId: 'shop-1' }) }))
vi.mock('@/lib/server/jobs', () => ({ enqueueJob: async () => { queued.count += 1; return 'job-1' } }))

describe('background job creation permissions', () => {
  it('does not let a client enqueue production exports or render work', async () => {
    process.env['DATABASE_URL'] = 'postgres://unused'
    const { POST } = await import('../app/api/v1/jobs/route')
    for (const input of [
      { kind: 'xlsx', projectId: 'b6495abb-025b-4937-8abc-9464f0779bc1' },
      { kind: 'render', key: 'photo/b6495abb-025b-4937-8abc-9464f0779bc1' },
    ]) {
      expect((await POST(new Request('http://localhost/api/v1/jobs', { method: 'POST', body: JSON.stringify(input) }))).status).toBe(403)
    }
    expect(queued.count).toBe(0)
    actor.role = 'designer'
    expect((await POST(new Request('http://localhost/api/v1/jobs', { method: 'POST',
      body: JSON.stringify({ kind: 'xlsx', projectId: 'b6495abb-025b-4937-8abc-9464f0779bc1' }) }))).status).toBe(202)
  })
})
