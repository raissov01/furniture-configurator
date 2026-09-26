import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-rate-limit-'))
let rate: typeof import('../lib/server/rateLimit')
beforeAll(async () => { rate = await import('../lib/server/rateLimit') })

describe('share IP лимиті', () => {
  it('тақырып жоқ не бос болса unknown ортақ шектеуге түседі', () => {
    const absent = rate.requestIp(new Request('http://localhost'))
    const empty = rate.requestIp(new Request('http://localhost', { headers: { 'x-real-ip': '  ' } }))
    expect(absent).toBe('unknown')
    expect(empty).toBe('unknown')
    const now = 1_800_000_000_000
    for (let i = 0; i < 5; i += 1) expect(rate.allowShareMiss(absent, String(i), now)).toBe(true)
    expect(rate.allowShareMiss(absent, 'next', now)).toBe(false)
    expect(rate.isShareLimited(absent, 'other', now)).toBe(true)
  })
})
