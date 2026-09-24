import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'

const dir = mkdtempSync(join(tmpdir(), 'furniture-role-migration-'))
process.env['DATA_DIR'] = dir

it('ескі мүшелер сақталып, founder owner болады', async () => {
  const old = new DatabaseSync(join(dir, 'furniture.db'))
  old.exec(`
    CREATE TABLE shops (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      shop_id TEXT NOT NULL, created_at INTEGER NOT NULL);
    INSERT INTO shops VALUES ('s', 'Цех', 1);
    INSERT INTO users VALUES ('founder', 'f@example.kz', 'x', 's', 1);
    INSERT INTO users VALUES ('member', 'm@example.kz', 'x', 's', 2);
  `)
  old.close()
  const { db, resetForTests } = await import('../lib/server/db')
  const database = db()
  const roles = database.prepare('SELECT id, role FROM users ORDER BY created_at').all()
  expect(roles).toEqual([{ id: 'founder', role: 'owner' }, { id: 'member', role: 'designer' }])
  // Қайта ашылған миграция рөлдерді қайта жазбайды.
  database.prepare("UPDATE users SET role = 'shop' WHERE id = 'member'").run()
  database.close()
  resetForTests()
  const second = db()
  expect((second.prepare("SELECT role FROM users WHERE id = 'member'").get() as { role: string }).role).toBe('shop')
})
