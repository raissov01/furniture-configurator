import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PostgreSQL deployment schema parity', () => {
  it('provides every table initialized by the current SQLite backend', () => {
    const sqlite = readFileSync(new URL('../lib/server/db.ts', import.meta.url), 'utf8')
    const directory = new URL('../docker/migrations/', import.meta.url)
    const postgres = readdirSync(directory).filter(name => /^\d+_.+\.sql$/.test(name))
      .sort().map(name => readFileSync(new URL(name, directory), 'utf8')).join('\n')
    const tables = [...sqlite.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(match => match[1]!)
    const missing = tables.filter(table => !new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table}\\s*\\(`, 'i').test(postgres))
    expect(missing).toEqual([])
  })
})
