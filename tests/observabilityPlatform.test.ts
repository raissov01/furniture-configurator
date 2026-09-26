import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { audit, observe, recentObservability } from '../lib/server/observability'
import { db } from '../lib/server/db'

describe('platform observability', () => {
  it('keeps audit rows inside the shop and records API status', async () => {
    const a = randomUUID()
    const b = randomUUID()
    db().prepare('INSERT INTO shops (id, name, created_at) VALUES (?, ?, ?)').run(a, 'A', 1)
    db().prepare('INSERT INTO shops (id, name, created_at) VALUES (?, ?, ?)').run(b, 'B', 1)
    audit({ shopId: a, action: 'create', entityType: 'project', entityId: 'p1' })
    expect(recentObservability(a).audit.some((row) => row.entity_id === 'p1')).toBe(true)
    expect(recentObservability(b).audit.some((row) => row.entity_id === 'p1')).toBe(false)
    const handler = observe('/api/v1/test', 'GET', async () => new Response(null, { status: 204 }))
    expect((await handler()).status).toBe(204)
    expect(db().prepare('SELECT status FROM api_metrics WHERE route = ? ORDER BY id DESC LIMIT 1').get('/api/v1/test'))
      .toMatchObject({ status: 204 })
    db().prepare('DELETE FROM shops WHERE id = ?').run(a)
    db().prepare('DELETE FROM shops WHERE id = ?').run(b)
  })
})
