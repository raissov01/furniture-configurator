import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '../lib/server/db'
import { claimJob, completeJob, enqueueJob, failJob, readJob } from '../lib/server/jobs'

if (process.env['DATABASE_URL']?.startsWith('postgres')) delete process.env['DATA_DIR']

describe.skipIf(!process.env['DATABASE_URL']?.startsWith('postgres'))('PostgreSQL worker queue', () => {
  it('claims once, scopes status by shop, and rejects stale completion', async () => {
    const shop = randomUUID()
    db().prepare('INSERT INTO shops (id, name, created_at) VALUES (?, ?, ?)').run(shop, 'Job shop', 1)
    const id = await enqueueJob(shop, 'xlsx', { projectId: randomUUID() }, 100)
    expect(await readJob(randomUUID(), id)).toBeNull()
    const first = await claimJob(100)
    expect(first?.id).toBe(id)
    expect(await claimJob(101)).toBeNull()
    await failJob(first!, new Error('retry'), 101)
    expect((await readJob(shop, id))?.state).toBe('pending')
    const second = await claimJob(31_000)
    expect(second?.id).toBe(id)
    expect(await completeJob(first!, { key: 'stale' })).toBe(false)
    expect(await completeJob(second!, { key: 'export/file' })).toBe(true)
    expect((await readJob(shop, id))?.state).toBe('done')
    db().prepare('DELETE FROM shops WHERE id = ?').run(shop)
  })
})
