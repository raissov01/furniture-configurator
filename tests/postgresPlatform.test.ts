import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'

const postgres = process.env['DATABASE_URL']?.startsWith('postgres')
if (postgres) delete process.env['DATA_DIR']

describe.skipIf(!postgres)('PostgreSQL platform adapter', () => {
  it('persists a shop and project through the existing synchronous database API', async () => {
    const { db } = await import('../lib/server/db')
    const database = db()
    expect(database.prepare('SELECT current_database() AS name').get()).toMatchObject({ name: new URL(process.env['DATABASE_URL']!).pathname.slice(1) })
    const shop = randomUUID()
    const project = randomUUID()
    database.prepare('INSERT INTO shops (id, name, created_at) VALUES (?, ?, ?)').run(shop, 'test', 1)
    database.prepare('INSERT INTO projects (id, shop_id, name, json, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(project, shop, 'sample', '{}', 1)
    expect(database.prepare('SELECT name FROM projects WHERE id = ? AND shop_id = ?').get(project, shop))
      .toMatchObject({ name: 'sample' })
    database.prepare('DELETE FROM shops WHERE id = ?').run(shop)
    expect(database.prepare('SELECT id FROM projects WHERE id = ?').get(project)).toBeUndefined()
  })

  it('rolls back a transaction and keeps binary photos intact', async () => {
    const { db } = await import('../lib/server/db')
    const database = db()
    const shop = randomUUID()
    database.prepare('INSERT INTO shops (id, name, created_at) VALUES (?, ?, ?)').run(shop, 'test', 1)
    database.exec('BEGIN IMMEDIATE')
    database.prepare('INSERT INTO mobile_measurement_photos (shop_id, id, mime, bytes, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(shop, 'photo', 'image/png', Buffer.from([0, 1, 255]), 'hash', 1)
    database.exec('ROLLBACK')
    expect(database.prepare('SELECT id FROM mobile_measurement_photos WHERE shop_id = ?').get(shop)).toBeUndefined()
    database.prepare('INSERT INTO mobile_measurement_photos (shop_id, id, mime, bytes, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(shop, 'photo', 'image/png', Buffer.from([0, 1, 255]), 'hash', 1)
    const row = database.prepare('SELECT bytes FROM mobile_measurement_photos WHERE shop_id = ?').get(shop) as { bytes: Uint8Array }
    expect([...row.bytes]).toEqual([0, 1, 255])
    database.prepare('DELETE FROM shops WHERE id = ?').run(shop)
  })
})
