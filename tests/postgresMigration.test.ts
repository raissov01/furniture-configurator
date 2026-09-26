import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { migrateSqliteToPostgres } from '../scripts/migrateSqliteToPostgres'

describe.skipIf(!process.env['DATABASE_URL']?.startsWith('postgres'))('SQLite migration', () => {
  it('copies rows and bytes, then refuses a second copy', async () => {
    const adminUrl = process.env['DATABASE_URL']!
    const name = `copy_${randomUUID().replaceAll('-', '')}`
    const admin = new Client({ connectionString: adminUrl })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${name}`)
    const url = new URL(adminUrl)
    url.pathname = `/${name}`
    const dir = mkdtempSync(join(tmpdir(), 'fc-copy-'))
    const path = join(dir, 'old.db')
    const source = new DatabaseSync(path)
    source.exec('CREATE TABLE shops (id TEXT PRIMARY KEY, name TEXT, created_at INTEGER)')
    source.exec('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, shop_id TEXT, created_at INTEGER)')
    source.exec('CREATE TABLE mobile_measurement_photos (shop_id TEXT, id TEXT, mime TEXT, bytes BLOB, sha256 TEXT, created_at INTEGER)')
    source.prepare('INSERT INTO shops VALUES (?, ?, ?)').run('s1', 'Цех', 1)
    source.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run('first', 'first@example.test', 'hash', 's1', 1)
    source.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run('second', 'second@example.test', 'hash', 's1', 2)
    source.prepare('INSERT INTO mobile_measurement_photos VALUES (?, ?, ?, ?, ?, ?)').run('s1', 'p1', 'image/png', Buffer.from([1, 2, 255]), 'hash', 2)
    source.close()
    try {
      const counts = await migrateSqliteToPostgres(path, url.toString())
      expect(counts.shops).toBe(1)
      expect(counts.users).toBe(2)
      expect(counts.mobile_measurement_photos).toBe(1)
      const dest = new Client({ connectionString: url.toString() })
      await dest.connect()
      const rows = await dest.query('SELECT name, plan FROM shops WHERE id = $1', ['s1'])
      const photo = await dest.query('SELECT bytes FROM mobile_measurement_photos WHERE id = $1', ['p1'])
      expect(rows.rows[0]?.name).toBe('Цех')
      expect(rows.rows[0]?.plan).toBe('free')
      const roles = await dest.query('SELECT id, role FROM users ORDER BY created_at')
      expect(roles.rows).toMatchObject([{ id: 'first', role: 'owner' }, { id: 'second', role: 'designer' }])
      expect([...photo.rows[0]?.bytes]).toEqual([1, 2, 255])
      await dest.end()
      await expect(migrateSqliteToPostgres(path, url.toString())).rejects.toThrow('not empty')
    } finally {
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`)
      await admin.end()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
