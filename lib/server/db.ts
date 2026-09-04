/**
 * Дерекқор. Node-тың ӨЗ SQLite-і (`node:sqlite`) — қосымша тәуелділік жоқ,
 * нативті құрастыру да жоқ. Файл `DATA_DIR` ішінде жатады.
 *
 * Неге SQLite: цехқа арналған жазылымда бір VPS жеткілікті, ал сыртқы база
 * әрі ақша, әрі тағы бір істен шығатын нүкте. Пішіні қарапайым SQL болғандықтан,
 * көлемі өскенде Postgres-ке көшу — драйверді ауыстыру ғана.
 */

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const FILE = process.env['DATA_DIR']
  ? join(process.env['DATA_DIR'], 'furniture.db')
  : join(process.cwd(), '.data', 'furniture.db')

let instance: DatabaseSync | null = null

export function db(): DatabaseSync {
  if (instance) return instance
  mkdirSync(dirname(FILE), { recursive: true })
  const database = new DatabaseSync(FILE)
  // Жазу кезінде оқу бөгелмеуі үшін.
  database.exec('PRAGMA journal_mode = WAL')
  database.exec('PRAGMA foreign_keys = ON')
  migrate(database)
  instance = database
  return database
}

/**
 * Схема. Миграция нөмірленген: жаңа қадам ТӨМЕНГЕ қосылады, ескісі
 * өзгертілмейді — істеп тұрған цехтың дерегі сынбауы керек.
 */
function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      shop_id       TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- Цех профилі: материалдар, бағалар, ережелер. Пішіні ядродағы
    -- ShopProfile-мен бірдей, сондықтан JSON болып жатады.
    CREATE TABLE IF NOT EXISTS shop_profiles (
      shop_id    TEXT PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
      json       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      shop_id    TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      json       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS projects_shop ON projects (shop_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
  `)

  /*
   * 2-қадам: тариф.
   *
   * `ALTER TABLE ... ADD COLUMN` бір рет қана өтеді, ал екінші рет
   * «duplicate column name» деп лақтырады. `IF NOT EXISTS` синтаксисі
   * SQLite-та ЖОҚ, сондықтан бағанның бар-жоғын кестенің өз мәліметінен
   * сұраймыз — миграция қайта жүргенде де сынбауы керек.
   */
  const columns = database.prepare('PRAGMA table_info(shops)').all() as { name: string }[]
  const has = (name: string) => columns.some((c) => c.name === name)
  if (!has('plan')) {
    database.exec("ALTER TABLE shops ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'")
  }
  if (!has('plan_until')) {
    // Тариф қашан бітеді, мс. NULL — мерзімсіз (тегін жоспар да, қолмен
    // берілген мерзімсіз жоспар да осында).
    database.exec('ALTER TABLE shops ADD COLUMN plan_until INTEGER')
  }

  /*
   * 3-қадам: командаға шақыру.
   *
   * Шақыру — БІР РЕТТІК токен: қабылданғаны `used_by`-мен белгіленеді де,
   * жол қайта жүрмейді. Жазба ӨШІРІЛМЕЙДІ — цех кімді кім шақырғанын кейін
   * көре алуы керек.
   */
  database.exec(`
    CREATE TABLE IF NOT EXISTS invites (
      token      TEXT PRIMARY KEY,
      shop_id    TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
      used_at    INTEGER,
      revoked_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS invites_shop ON invites (shop_id, created_at DESC);
  `)
}

/** Тек тесте: жадтағы таза базамен жұмыс істеу. */
export function resetForTests(): void {
  instance = null
}
