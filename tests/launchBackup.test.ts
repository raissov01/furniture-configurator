import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { rmSync } from 'node:fs'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function run(...args: string[]) {
  return spawnSync('python3', ['scripts/launch_backup.py', ...args], { cwd: process.cwd(), encoding: 'utf8' })
}

function pgQuery(url: string, sql: string) {
  return execFileSync('psql', ['-At', '-d', url, '-c', sql], { encoding: 'utf8' }).trim()
}

it('passes PostgreSQL URL fields through libpq environment variables', () => {
  const code = `import importlib.util,json
spec=importlib.util.spec_from_file_location('backup','scripts/launch_backup.py')
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
env=module.pg_environment('postgresql://alice:p%40ss@db.internal:5433/furniture?sslmode=require')
print(json.dumps({key:env.get(key) for key in ('PGUSER','PGPASSWORD','PGHOST','PGPORT','PGDATABASE','PGSSLMODE')}))`
  const output = execFileSync('python3', ['-c', code], { cwd: process.cwd(), encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  expect(JSON.parse(output)).toEqual({ PGUSER: 'alice', PGPASSWORD: 'p@ss', PGHOST: 'db.internal',
    PGPORT: '5433', PGDATABASE: 'furniture', PGSSLMODE: 'require' })
})

it('backs up a live SQLite WAL database and files, then restores identical content', () => {
  const root = mkdtempSync(join(tmpdir(), 'launch-backup-'))
  roots.push(root)
  const data = join(root, 'data')
  const backups = join(root, 'backups')
  const restored = join(root, 'restored')
  mkdirSync(join(data, 'objects', 'shop'), { recursive: true })
  mkdirSync(join(data, 'ar'), { recursive: true })
  writeFileSync(join(data, 'objects', 'shop', 'asset'), Buffer.from([0, 1, 255]))
  writeFileSync(join(data, 'ar', 'model.glb'), 'model')
  execFileSync('python3', ['-c', `import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('PRAGMA journal_mode=WAL'); c.execute('CREATE TABLE projects (id TEXT, title TEXT)'); c.execute("INSERT INTO projects VALUES ('one', 'Тест')"); c.commit()`, join(data, 'furniture.db')])

  const backup = run('backup', '--mode', 'sqlite', '--data-dir', data, '--backup-dir', backups)
  expect(backup.status, backup.stderr).toBe(0)
  const archives = readdirSync(backups).filter((name) => name.endsWith('.tar.gz'))
  expect(archives).toHaveLength(1)
  const restore = run('restore', '--archive', join(backups, archives[0]!), '--restore-dir', restored)
  expect(restore.status, restore.stderr).toBe(0)
  const rows = execFileSync('python3', ['-c', `import sqlite3,json,sys; print(json.dumps(sqlite3.connect(sys.argv[1]).execute('SELECT * FROM projects').fetchall(), ensure_ascii=False))`, join(restored, 'furniture.db')], { encoding: 'utf8' })
  expect(JSON.parse(rows)).toEqual([['one', 'Тест']])
  expect(readFileSync(join(restored, 'objects', 'shop', 'asset'))).toEqual(Buffer.from([0, 1, 255]))
  expect(readFileSync(join(restored, 'ar', 'model.glb'), 'utf8')).toBe('model')
  expect(run('restore', '--archive', join(backups, archives[0]!), '--restore-dir', restored).status).not.toBe(0)

  const corrupt = join(root, 'corrupt.tar.gz')
  execFileSync('python3', ['-c', `import io,tarfile,sys
with tarfile.open(sys.argv[1], 'r:gz') as source, tarfile.open(sys.argv[2], 'w:gz') as target:
 for member in source:
  data = source.extractfile(member).read()
  if member.name == 'files/ar/model.glb': data = b'other'
  member.size = len(data)
  target.addfile(member, io.BytesIO(data))`, join(backups, archives[0]!), corrupt])
  const tampered = join(root, 'tampered')
  expect(run('restore', '--archive', corrupt, '--restore-dir', tampered).status).not.toBe(0)
  expect(existsSync(tampered)).toBe(false)
})

it.skipIf(!process.env['PG_LAUNCH_SOURCE_URL'] || !process.env['PG_LAUNCH_RESTORE_URL'])(
  'dumps disposable PostgreSQL source and restores identical rows to an empty database', () => {
    const sourceUrl = process.env['PG_LAUNCH_SOURCE_URL']!
    const restoreUrl = process.env['PG_LAUNCH_RESTORE_URL']!
    const root = mkdtempSync(join(tmpdir(), 'launch-pg-'))
    roots.push(root)
    mkdirSync(join(root, 'data'))
    const table = `launch_probe_${Date.now()}`
    expect(pgQuery(restoreUrl, "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")).toBe('0')
    try {
      pgQuery(sourceUrl, `CREATE TABLE ${table} (id integer PRIMARY KEY, title text); INSERT INTO ${table} VALUES (1, 'Тест');`)
      const result = spawnSync('python3', ['scripts/launch_backup.py', 'backup', '--mode', 'postgres',
        '--data-dir', join(root, 'data'), '--backup-dir', join(root, 'backups')],
      { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, DATABASE_URL: sourceUrl } })
      expect(result.status, result.stderr).toBe(0)
      const archive = readdirSync(join(root, 'backups')).find((name) => name.endsWith('.tar.gz'))!
      const restored = spawnSync('python3', ['scripts/launch_backup.py', 'restore', '--archive',
        join(root, 'backups', archive), '--restore-dir', join(root, 'restored')],
      { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, DATABASE_URL: restoreUrl } })
      expect(restored.status, restored.stderr).toBe(0)
      expect(pgQuery(restoreUrl, `SELECT id, title FROM ${table}`)).toBe(pgQuery(sourceUrl, `SELECT id, title FROM ${table}`))
    } finally {
      pgQuery(sourceUrl, `DROP TABLE IF EXISTS ${table}`)
      pgQuery(restoreUrl, `DROP TABLE IF EXISTS ${table}`)
    }
  },
)
