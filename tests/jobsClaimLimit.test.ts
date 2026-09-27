import { expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ queries: [] as string[] }))
vi.mock('pg', () => ({ Pool: class {
  async query(sql: string) {
    mock.queries.push(sql)
    return { rows: [], rowCount: 0 }
  }
} }))
import { claimJob } from '../lib/server/jobs'

it('үш сәтсіз lease-тен кейін тапсырманы failed қылып, қайта claim етпейді', async () => {
  process.env['DATABASE_URL'] = 'postgres://job-test'
  mock.queries = []
  expect(await claimJob(1000)).toBeNull()
  expect(mock.queries.some((sql) => /UPDATE jobs SET state = 'failed'/.test(sql) && /attempts >= \$\d/.test(sql))).toBe(true)
  expect(mock.queries.some((sql) => /attempts < \$\d/.test(sql) && /FOR UPDATE SKIP LOCKED/.test(sql))).toBe(true)
})
