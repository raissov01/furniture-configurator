import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { setTimeout as pause } from 'node:timers/promises'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe.skipIf(!process.env['DATABASE_URL']?.startsWith('postgres'))('PostgreSQL worker startup', () => {
  it('runs schema migrations before polling jobs in a fresh database', async () => {
    const adminUrl = process.env['DATABASE_URL']!
    const name = `worker_${randomUUID().replaceAll('-', '')}`
    const admin = new Client({ connectionString: adminUrl })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${name}`)
    const url = new URL(adminUrl)
    url.pathname = `/${name}`
    const worker = spawn(process.execPath, ['--import', 'tsx', 'scripts/worker.ts'], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url.toString(), PLATFORM_ROOT: process.cwd() },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let errors = ''
    worker.stderr.on('data', (chunk: Buffer) => { errors += chunk.toString() })
    try {
      await pause(2500)
      expect(worker.exitCode, errors).toBeNull()
      const database = new Client({ connectionString: url.toString() })
      await database.connect()
      try {
        const table = await database.query<{ name: string | null }>("SELECT to_regclass('public.jobs')::text AS name")
        expect(table.rows[0]?.name).toBe('jobs')
      } finally {
        await database.end()
      }
    } finally {
      worker.kill('SIGKILL')
      await pause(150)
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`)
      await admin.end()
    }
  }, 15_000)
})
