// PostgreSQL runs in a worker so the existing synchronous SQLite service API stays stable.
const { parentPort, workerData } = require('node:worker_threads')
const { Client, types } = require('pg')
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

types.setTypeParser(20, (value) => Number(value)) // bigint stores millisecond timestamps and counts.
const client = new Client({ connectionString: workerData.url, connectionTimeoutMillis: 5000 })
const ready = (async () => {
  await client.connect()
  if (workerData.schema) {
    if (!/^[a-z0-9_]+$/.test(workerData.schema)) throw new Error('Invalid test schema')
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${workerData.schema}`)
    await client.query(`SET search_path TO ${workerData.schema}`)
  }
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock(42092025)')
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at bigint NOT NULL)')
    for (const file of readdirSync(workerData.migrations).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()) {
      const exists = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file])
      if (exists.rowCount) continue
      await client.query(readFileSync(join(workerData.migrations, file), 'utf8'))
      await client.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)', [file, Date.now()])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
})()

function placeholders(sql) {
  let index = 0
  return sql.replace(/'([^']|'')*'|\?/g, (match) => {
    if (match !== '?') return match
    return `$${++index}`
  })
}

async function execute(message) {
  await ready
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
