import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, expect, it } from 'vitest'
import { PostgresCompat } from '../lib/server/postgres'

const root = mkdtempSync(join(tmpdir(), 'pg-bridge-'))
mkdirSync(join(root, 'lib/server'), { recursive: true })
writeFileSync(join(root, 'lib/server/pgWorker.cjs'), `
const { parentPort, workerData } = require('node:worker_threads')
const state = new Int32Array(workerData.state)
Atomics.store(state, 0, 1)
parentPort.on('message', ({ port }) => port.on('message', ({ id, sql }) => {
  if (sql === 'DOWN') { Atomics.store(state, 0, -1); setTimeout(() => Atomics.store(state, 0, 1), 100); return }
  if (sql === 'SLOW') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  port.postMessage({ id, ok: true, value: { rows: [{ sql }], changes: 0 } })
}))
`)
const oldRoot = process.env['PLATFORM_ROOT']
beforeEach(() => { process.env['PLATFORM_ROOT'] = root })
afterAll(() => {
  if (oldRoot === undefined) delete process.env['PLATFORM_ROOT']
  else process.env['PLATFORM_ROOT'] = oldRoot
  rmSync(root, { recursive: true, force: true })
})

it('тайм-ауттан соң worker жаңарып, келесі сұрау ескі жауапты алмайды', () => {
  const db = new PostgresCompat('postgres://fake', undefined, 300)
  try {
    expect(() => db.prepare('SLOW').get()).toThrow(/timed out/)
    expect(db.prepare('FAST').get()).toEqual({ sql: 'FAST' })
    expect(db.prepare('NEXT').get()).toEqual({ sql: 'NEXT' })
  } finally { db.close() }
})

it('байланыс үзілгенін тез хабарлап, қайта қосылғанда сұрауды орындайды', async () => {
  const db = new PostgresCompat('postgres://fake', undefined, 300)
  try {
    expect(db.prepare('READY').get()).toEqual({ sql: 'READY' })
    const started = Date.now()
    expect(() => db.prepare('DOWN').get()).toThrow(/unavailable|connection/i)
    expect(Date.now() - started).toBeLessThan(250)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(db.prepare('AFTER').get()).toEqual({ sql: 'AFTER' })
  } finally { db.close() }
})

it('нақты worker алғашқы connect қатесінен және client error-дан қайта қосылады', async () => {
  const mockRoot = mkdtempSync(join(tmpdir(), 'pg-reconnect-'))
  mkdirSync(join(mockRoot, 'lib/server'), { recursive: true })
  mkdirSync(join(mockRoot, 'docker/migrations'), { recursive: true })
  mkdirSync(join(mockRoot, 'node_modules/pg'), { recursive: true })
  copyFileSync(join(process.cwd(), 'lib/server/pgWorker.cjs'), join(mockRoot, 'lib/server/pgWorker.cjs'))
  writeFileSync(join(mockRoot, 'node_modules/pg/index.js'), `
const { EventEmitter } = require('node:events')
let connects = 0
class Client extends EventEmitter {
  async connect() { if (++connects === 1) throw new Error('database starting') }
  async query(sql) {
    if (sql === 'DISCONNECT') { this.emit('error', new Error('connection lost')); throw new Error('connection lost') }
    return { rows: [{ sql }], rowCount: 1 }
  }
  async end() {}
}
module.exports = { Client, types: { setTypeParser() {} } }
`)
  process.env['PLATFORM_ROOT'] = mockRoot
  const db = new PostgresCompat('postgres://fake', undefined, 2000)
  try {
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(() => db.prepare('FIRST').get()).toThrow(/unavailable|starting/)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(db.prepare('SECOND').get()).toEqual({ sql: 'SECOND' })
    expect(() => db.prepare('DISCONNECT').get()).toThrow(/unavailable|lost/)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    expect(db.prepare('RECOVERED').get()).toEqual({ sql: 'RECOVERED' })
  } finally { db.close(); rmSync(mockRoot, { recursive: true, force: true }) }
})
