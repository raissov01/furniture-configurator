import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('Базис e2e Chrome іске қосылмауы', () => {
  it('басқарылатын қате шығарып, екі уақытша буманы да тазалайды', () => {
    const dir = mkdtempSync(join(tmpdir(), 'basis-e2e-failure-test-'))
    dirs.push(dir)
    const result = spawnSync(process.execPath, ['scripts/e2e-basis-export.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, TMPDIR: dir, CHROME: '/no/such/browser' },
      encoding: 'utf8',
      timeout: 10000,
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Basis export e2e: FAIL')
    expect(result.stderr).not.toContain("Unhandled 'error' event")
    expect(readdirSync(dir)).toEqual([])
  })
})
