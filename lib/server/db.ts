/**
 * Әдепкі дерекқор — Node-тың SQLite-і (`node:sqlite`), файл `DATA_DIR` ішінде.
 * DATABASE_URL PostgreSQL болса, бұрынғы синхронды service интерфейсін
 * бөлек worker-де жұмыс істейтін PostgreSQL адаптері сақтайды.
 */

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { PostgresCompat } from './postgres'

const FILE = process.env['DATA_DIR']
  ? join(process.env['DATA_DIR'], 'furniture.db')
  : join(process.cwd(), '.data', 'furniture.db')

let instance: DatabaseSync | null = null

export function db(): DatabaseSync {
  if (instance) return instance
  const url = process.env['DATABASE_URL']
  if (url?.startsWith('postgres://') || url?.startsWith('postgresql://')) {
    const prefix = process.env['PG_TEST_SCHEMA_PREFIX']
    const schema = prefix && process.env['DATA_DIR']
      ? `${prefix.replace(/[^a-z0-9_]/gi, '').slice(0, 20)}_${createHash('sha256').update(process.env['DATA_DIR']).digest('hex').slice(0, 16)}`
      : undefined
    instance = new PostgresCompat(url, schema) as unknown as DatabaseSync
    return instance
  }
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

  /*
   * 4-қадам: клиентке КОД (qdesign «3D-көріністе ашу» сияқты, 09-13).
   *
   * 6 таңбалы код 24 сағат жарамды. `key` — ЖАҢАРТУДЫҢ құпиясы: кодты
   * білген клиент жобаны тек КӨРЕДІ, өзгерте алатын — кодты жасаған цех
   * (автоматты жаңарту сол кілтпен жүреді).
   */
  database.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      code       TEXT PRIMARY KEY,
      key        TEXT NOT NULL,
      json       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS shares_expiry ON shares (expires_at);
  `)

  // 5-қадам: бар аккаунттар сақталады. Әр цехтың алғашқы адамы — owner,
  // қалған бұрынғы мүшелер designer; жаңа шақыру рөлді анық көрсетеді.
  const userColumns = database.prepare('PRAGMA table_info(users)').all() as { name: string }[]
  if (!userColumns.some((column) => column.name === 'role')) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'designer'")
    database.exec(`UPDATE users SET role = 'owner' WHERE id IN
      (SELECT id FROM users AS first WHERE first.id =
        (SELECT id FROM users AS member WHERE member.shop_id = first.shop_id
         ORDER BY member.created_at, member.id LIMIT 1))`)
  }
  const inviteColumns = database.prepare('PRAGMA table_info(invites)').all() as { name: string }[]
  if (!inviteColumns.some((column) => column.name === 'role')) {
    database.exec("ALTER TABLE invites ADD COLUMN role TEXT NOT NULL DEFAULT 'designer'")
  }

  // 6-қадам: кодты жасаған цехты ғана дизайнер inbox-ына жібереміз.
  const shareColumns = database.prepare('PRAGMA table_info(shares)').all() as { name: string }[]
  if (!shareColumns.some((column) => column.name === 'shop_id')) {
    database.exec('ALTER TABLE shares ADD COLUMN shop_id TEXT REFERENCES shops(id) ON DELETE CASCADE')
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL REFERENCES shares(code) ON DELETE CASCADE,
      target_id TEXT,
      body TEXT NOT NULL,
      author TEXT NOT NULL,
      author_role TEXT NOT NULL CHECK (author_role IN ('client', 'designer', 'creator')),
      reply_to TEXT REFERENCES comments(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS comments_code ON comments (code, created_at);
  `)

  // 7-қадам: share кодын болжау мен пікір спамына арналған қысқа мерзімді есептегіш.
  database.exec(`CREATE TABLE IF NOT EXISTS request_limits (
    bucket TEXT NOT NULL, subject TEXT NOT NULL, window_start INTEGER NOT NULL,
    attempts INTEGER NOT NULL, PRIMARY KEY (bucket, subject, window_start)
  )`)

  // 8-қадам: әр пайдаланушының өз ағаш элементтері; цехтың ортақ жобасына қосылмайды.
  database.exec(`CREATE TABLE IF NOT EXISTS library_items (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL, json TEXT NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  )`)

  // 9-қадам: импортталған каталог тек иесінің цехына тиесілі. Шикі файл сақталмайды.
  database.exec(`CREATE TABLE IF NOT EXISTS shop_catalog_imports (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    format TEXT NOT NULL,
    json TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    rights_confirmed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS shop_catalog_imports_shop ON shop_catalog_imports (shop_id, created_at DESC)`)

  // PRO100 суреттерінің иесі мен көлемі серверде сақталады; URL құпия токен емес.
  database.exec(`CREATE TABLE IF NOT EXISTS shop_catalog_images (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    import_id TEXT NOT NULL REFERENCES shop_catalog_imports(id) ON DELETE CASCADE,
    extension TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS shop_catalog_images_shop ON shop_catalog_images (shop_id)`)

  // Монтаж актісі бөлек сақталады: офлайн әрекеттің ID-і қайта жіберілсе,
  // revision де, төлем оқиғасы да екінші рет пайда болмауы керек.
  database.exec(`
    CREATE TABLE IF NOT EXISTS installation_tasks (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS installation_tasks_shop ON installation_tasks (shop_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS installation_actions (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES installation_tasks(id) ON DELETE CASCADE,
      request_json TEXT NOT NULL,
      revision_version INTEGER NOT NULL,
      revision_updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS installation_events (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL UNIQUE REFERENCES installation_tasks(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      processed_at INTEGER
    );
  `)

  // 11-қадам: телефон замерінің нұсқалары мен фото байты цех шекарасында жатады.
  // Әрекет ID-і бір цех ішінде бірегей; қайталанған жіберу екінші нұсқа жасамайды.
  database.exec(`
    CREATE TABLE IF NOT EXISTS mobile_measurements (
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      json TEXT NOT NULL,
      revision_version INTEGER NOT NULL,
      revision_updated_at INTEGER NOT NULL,
      PRIMARY KEY (shop_id, id)
    );
    CREATE TABLE IF NOT EXISTS mobile_measurement_actions (
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      request_json TEXT NOT NULL,
      revision_version INTEGER NOT NULL,
      revision_updated_at INTEGER NOT NULL,
      PRIMARY KEY (shop_id, id)
    );
    CREATE TABLE IF NOT EXISTS mobile_measurement_photos (
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      mime TEXT NOT NULL,
      bytes BLOB NOT NULL,
      sha256 TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (shop_id, id)
    );
  `)

  // 12-қадам: аудит, API өнімділігі, қате журналы және фондық тапсырмалар.
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id TEXT REFERENCES shops(id) ON DELETE CASCADE,
      actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
      detail_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_log_shop_time ON audit_log (shop_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS api_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT, route TEXT NOT NULL, method TEXT NOT NULL,
      status INTEGER NOT NULL, latency_ms INTEGER NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS api_metrics_time ON api_metrics (created_at DESC);
    CREATE TABLE IF NOT EXISTS error_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, route TEXT NOT NULL, message TEXT NOT NULL,
      stack TEXT, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS error_log_time ON error_log (created_at DESC);
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload_json TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      run_after INTEGER NOT NULL, lease_until INTEGER, last_error TEXT,
      created_at INTEGER NOT NULL, shop_id TEXT REFERENCES shops(id) ON DELETE CASCADE,
      result_json TEXT, lease_token TEXT
    );
    CREATE INDEX IF NOT EXISTS jobs_ready ON jobs (state, run_after);
  `)

  // 13-қадам: әр пайдаланушының бұлт жобаларының папкасы мен сұрыптауы.
  database.exec(`
    CREATE TABLE IF NOT EXISTS cloud_project_org (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  // 12-қадам: ЖИ-рендер тарихы. Әр жазба бір ПАЙДАЛАНУШЫҒА тиесілі (цехтың
  // басқа мүшесі де көрмейді); жоба id-і клиенттікі болуы мүмкін (жергілікті
  // жоба), сондықтан projects кестесіне сілтеме ЖОҚ.
  database.exec(`
    CREATE TABLE IF NOT EXISTS render_history (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL,
      json TEXT NOT NULL,
      image BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS render_history_owner ON render_history (user_id, project_id, created_at DESC);
  `)

  // 14-қадам: құпиясөзді қалпына келтіру. Сілтеменің өзі ешқашан базада сақталмайды.
  database.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets (user_id, expires_at);
  `)
}

/** Тек тесте: жадтағы таза базамен жұмыс істеу. */
export function resetForTests(): void {
  instance = null
}
