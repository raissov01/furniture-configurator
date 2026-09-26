import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client, types } from 'pg'

const TABLES = [
  'shops', 'users', 'sessions', 'shop_profiles', 'projects', 'invites', 'shares',
  'comments', 'request_limits', 'library_items', 'shop_catalog_imports',
  'installation_tasks', 'installation_actions', 'installation_events',
  'mobile_measurements', 'mobile_measurement_actions', 'mobile_measurement_photos',
  'approval_revisions',
] as const

types.setTypeParser(20, Number)

/** Transactional copy. Destination must be empty; counts are checked before commit. */
export async function migrateSqliteToPostgres(sqlitePath: string, url: string): Promise<Record<string, number>> {
  const source = new DatabaseSync(sqlitePath, { readOnly: true })
  const target = new Client({ connectionString: url })
  const counts: Record<string, number> = {}
  await target.connect()
  try {
    await target.query('BEGIN')
    await target.query('SELECT pg_advisory_xact_lock(42092025)')
    await target.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at bigint NOT NULL)')
    for (const file of readdirSync(join(process.cwd(), 'docker/migrations')).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
      const exists = await target.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file])
      if (exists.rowCount) continue
      await target.query(readFileSync(join(process.cwd(), 'docker/migrations', file), 'utf8'))
      await target.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1,$2)', [file, Date.now()])
    }
    const present = new Set((source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((row) => row.name))
    for (const table of TABLES) {
      const existing = await target.query(`SELECT COUNT(*)::integer AS n FROM ${table}`)
      if (existing.rows[0]?.n !== 0) throw new Error(`PostgreSQL target table is not empty: ${table}`)
      if (!present.has(table)) { counts[table] = 0; continue }
      const rows = source.prepare(`SELECT * FROM ${table}`).all() as Record<string, string | number | bigint | null | Uint8Array>[]
      const columns = (source.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name)
      // SQLite v1 users had no role. Reproduce the v5 founder migration while copying.
      const founders = new Map<string, string>()
      if (table === 'users' && !columns.includes('role')) {
        const ordered = [...rows].sort((a, b) => Number(a['created_at']) - Number(b['created_at'])
          || String(a['id']).localeCompare(String(b['id'])))
        for (const row of ordered) {
          const shopId = String(row['shop_id'])
          if (!founders.has(shopId)) founders.set(shopId, String(row['id']))
        }
        columns.push('role')
      }
      for (const row of rows) {
        const values = columns.map((column) => {
          if (column === 'role' && table === 'users' && !(column in row)) {
            return founders.get(String(row['shop_id'])) === row['id'] ? 'owner' : 'designer'
          }
          return row[column] instanceof Uint8Array ? Buffer.from(row[column]) : row[column]
        })
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(',')
        await target.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`, values)
      }
      const checked = await target.query(`SELECT COUNT(*)::integer AS n FROM ${table}`)
      if (checked.rows[0]?.n !== rows.length) throw new Error(`Count mismatch: ${table}`)
      counts[table] = rows.length
    }
    await target.query('COMMIT')
    return counts
  } catch (error) {
    await target.query('ROLLBACK')
    throw error
  } finally {
    source.close()
    await target.end()
  }
}

if (process.argv[1]?.endsWith('migrateSqliteToPostgres.ts')) {
  const [, , sqlitePath, urlArg] = process.argv
  const url = urlArg ?? process.env['DATABASE_URL']
  if (!sqlitePath || !url) throw new Error('Usage: DATABASE_URL=postgresql://… tsx scripts/migrateSqliteToPostgres.ts <sqlite-file>')
  migrateSqliteToPostgres(sqlitePath, url).then((counts) => console.log(JSON.stringify(counts)))
}
