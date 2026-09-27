// PostgreSQL runs in a worker so the existing synchronous SQLite service API stays stable.
const { parentPort, workerData } = require('node:worker_threads')
const { Client, types } = require('pg')
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

types.setTypeParser(20, (value) => Number(value)) // bigint stores millisecond timestamps and counts.
const state = new Int32Array(workerData.state)
let client = null
let connecting = null
let retryTimer = null

function retryLater() {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void ensureConnected().catch(() => retryLater())
  }, 1000)
}

async function openConnection() {
  const next = new Client({ connectionString: workerData.url, connectionTimeoutMillis: 5000 })
  next.on('error', () => {
    if (client && client !== next) return
    if (client === next) client = null
    Atomics.store(state, 0, -1)
    retryLater()
  })
  try {
    await next.connect()
    // Both limits are below the bridge's 30 s deadline, including lock waits.
    await next.query("SET statement_timeout = '25000ms'")
    await next.query("SET lock_timeout = '5000ms'")
    if (workerData.schema) {
      if (!/^[a-z0-9_]+$/.test(workerData.schema)) throw new Error('Invalid test schema')
      await next.query(`CREATE SCHEMA IF NOT EXISTS ${workerData.schema}`)
      await next.query(`SET search_path TO ${workerData.schema}`)
    }
    await next.query('BEGIN')
    try {
      await next.query('SELECT pg_advisory_xact_lock(42092025)')
      await next.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at bigint NOT NULL)')
      for (const file of readdirSync(workerData.migrations).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
        const exists = await next.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file])
        if (exists.rowCount) continue
        await next.query(readFileSync(join(workerData.migrations, file), 'utf8'))
        await next.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)', [file, Date.now()])
      }
      await next.query('COMMIT')
    } catch (error) {
      await next.query('ROLLBACK')
      throw error
    }
    client = next
    Atomics.store(state, 0, 1)
    return next
  } catch (error) {
    Atomics.store(state, 0, -1)
    await next.end().catch((closeError) => console.error('PostgreSQL close after failed connect:', closeError))
    throw error
  }
}

function ensureConnected() {
  if (client) return Promise.resolve(client)
  if (!connecting) connecting = openConnection().finally(() => { connecting = null })
  return connecting
}

void ensureConnected().catch(() => retryLater())

function placeholders(sql) {
  let index = 0
  return sql.replace(/'([^']|'')*'|\?/g, (match) => {
    if (match !== '?') return match
    return `$${++index}`
  })
}

async function execute(message) {
  const client = await ensureConnected()
  let sql = message.sql.trim()
  if (/^CREATE TABLE/i.test(sql)) sql = sql.replace(/\bBLOB\b/gi, 'bytea').replace(/\bINTEGER\b/gi, 'bigint')
  if (/^BEGIN(?: IMMEDIATE)?$/i.test(sql)) {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(42092026)')
    return { rows: [], changes: 0 }
  }
  if (/^(COMMIT|ROLLBACK)$/i.test(sql)) {
    await client.query(sql)
    return { rows: [], changes: 0 }
  }
  if (/^PRAGMA/i.test(sql)) throw new Error('PRAGMA is SQLite-only')
  const args = (message.args || []).map((value) => value instanceof Uint8Array ? Buffer.from(value) : value)
  const result = await client.query(placeholders(sql), args)
  return { rows: result.rows || [], changes: result.rowCount || 0 }
}

parentPort.on('message', ({ port }) => {
  port.on('message', async (message) => {
    try { port.postMessage({ id: message.id, ok: true, value: await execute(message) }) }
    catch (error) {
      // Leave failed explicit transactions in the same state as SQLite callers expect.
      port.postMessage({ id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })
})
