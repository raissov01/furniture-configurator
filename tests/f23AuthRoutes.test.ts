import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-f23-auth-'))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))

let auth: typeof import('../lib/server/auth')
let registerRoute: typeof import('../app/api/auth/register/route')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  registerRoute = await import('../app/api/auth/register/route')
})

const registration = (body: unknown) => registerRoute.POST(new Request('http://localhost/api/auth/register', {
  method: 'POST', body: JSON.stringify(body),
}))

describe('F23 тіркелу валидациясы', () => {
  it('сан түріндегі цех атауын әдепкі атауға үнсіз ауыстырмайды', async () => {
    const response = await registration({ email: 'numeric-shop@example.kz', password: 'password123', shopName: 1.5 })
    expect(response.status).toBe(400)
    expect((await response.json() as { error: string }).error).toMatch(/цех|назван/i)
    expect(auth.login('numeric-shop@example.kz', 'password123').ok).toBe(false)
  })

  it('ұзын атауды қабылдамайды, бос атауға жарияланған әдепкі атауды береді', async () => {
    const tooLong = await registration({ email: 'long-shop@example.kz', password: 'password123', shopName: 'А'.repeat(101) })
    expect(tooLong.status).toBe(400)
    expect((await tooLong.json() as { error: string }).error).toMatch(/100/)
    const empty = await registration({ email: 'empty-shop@example.kz', password: 'password123', shopName: '  ' })
    expect(empty.status).toBe(200)
    expect((await empty.json() as { account: { shopName: string } }).account.shopName).toBe('Мой цех')
  })
})
