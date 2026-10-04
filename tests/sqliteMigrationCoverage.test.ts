import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pg = vi.hoisted(() => ({ queries: [] as string[], inserted: new Map<string, unknown[][]>(), ended: vi.fn() }))
vi.mock('pg', () => ({
  types: { setTypeParser: vi.fn() },
  Client: class {
    async connect() {}
    async end() { pg.ended() }
    async query(sql: string, values?: unknown[]) {
      pg.queries.push(sql)
      const insert = /^INSERT INTO (\w+) /.exec(sql)
      if (insert) pg.inserted.set(insert[1]!, [...(pg.inserted.get(insert[1]!) ?? []), values ?? []])
      const count = /^SELECT COUNT\(\*\)::integer AS n FROM (\w+)/.exec(sql)
      return { rows: count ? [{ n: pg.inserted.get(count[1]!)?.length ?? 0 }] : [], rowCount: 0 }
    }
  },
}))
import { migrateSqliteToPostgres } from '../scripts/migrateSqliteToPostgres'

let directory: string, path: string
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'fc-migration-unit-')); path = join(directory, 'source.db')
  pg.queries = []; pg.inserted.clear(); pg.ended.mockClear()
})
afterEach(() => rmSync(directory, { recursive: true, force: true }))

describe('SQLite migration loss prevention (mock PostgreSQL transport)', () => {
  it('copies newer feature tables and restores generated-ID sequences', async () => {
    const source = new DatabaseSync(path)
    const newer = ['shop_catalog_images', 'cloud_project_org', 'render_history', 'password_resets', 'audit_log', 'api_metrics', 'error_log', 'jobs']
    for (const name of newer) {
      source.exec(`CREATE TABLE ${name} (id INTEGER PRIMARY KEY, json TEXT, bytes BLOB)`)
      source.prepare(`INSERT INTO ${name} VALUES (?, ?, ?)`).run(42, '{"preserved":true}', new Uint8Array([0, 2, 255]))
    }
    source.close()
    const counts = await migrateSqliteToPostgres(path, 'postgres://unit-test.invalid/no-connection')
    for (const name of newer) {
      expect(counts[name], name).toBe(1)
      expect(pg.inserted.get(name), name).toEqual([[42, '{"preserved":true}', Buffer.from([0, 2, 255])]])
    }
    for (const name of ['audit_log', 'api_metrics', 'error_log']) {
      expect(pg.queries.some(sql => sql.includes('setval') && sql.includes(`'${name}'`)), name).toBe(true)
    }
    expect(pg.queries.at(-1)).toBe('COMMIT')
    expect(pg.ended).toHaveBeenCalledOnce()
  })
  it('rolls back when an unknown source table would otherwise be silently discarded', async () => {
    const source = new DatabaseSync(path)
    source.exec('CREATE TABLE future_customer_data (id TEXT)')
    source.close()
    await expect(migrateSqliteToPostgres(path, 'postgres://unit-test.invalid/no-connection'))
      .rejects.toThrow(/future_customer_data/)
    expect(pg.queries).toContain('ROLLBACK')
    expect(pg.queries).not.toContain('COMMIT')
  })
})
