import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-f23-login-'))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))

let auth: typeof import('../lib/server/auth')
let loginRoute: typeof import('../app/api/auth/login/route')

beforeAll(async () => {
  auth = await import('../lib/server/auth')
  loginRoute = await import('../app/api/auth/login/route')
})

const login = (email: string, password: string, ip: string, forwarded?: string) =>
  loginRoute.POST(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'x-real-ip': ip, ...(forwarded ? { 'x-forwarded-for': forwarded } : {}) },
    body: JSON.stringify({ email, password }),
  }))

describe('F23 login шектеуі', () => {
  it('сәтті кіру қате әрекет шегін толтырмайды', async () => {
    auth.register('legitimate@example.kz', 'password123', 'Цех')
    for (let index = 0; index < 6; index += 1) {
      expect((await login('legitimate@example.kz', 'password123', '203.0.113.12')).status).toBe(200)
    }
  })

  it('бір аккаунтқа бес қате әрекеттен кейін 429 береді, дұрыс құпиясөзбен де айналып өтпейді', async () => {
    auth.register('target@example.kz', 'password123', 'Цех')
    for (let index = 0; index < 5; index += 1) {
      expect((await login('target@example.kz', 'wrong-password', `192.0.2.${index + 1}`)).status).toBe(401)
    }
    const blocked = await login('target@example.kz', 'password123', '192.0.2.99')
    expect(blocked.status).toBe(429)
    expect((await blocked.json() as { error: string }).error).not.toContain('target@example.kz')
    expect((await login('other@example.kz', 'wrong-password', '192.0.2.99')).status).toBe(401)
  })

  it('бір IP-дің шашыраңқы 20 қатесін шектейді, x-forwarded-for оны айналып өтпейді', async () => {
    for (let index = 0; index < 20; index += 1) {
      expect((await login(`spray-${index}@example.kz`, 'wrong-password', '198.51.100.7')).status).toBe(401)
    }
    expect((await login('fresh@example.kz', 'wrong-password', '198.51.100.7', '203.0.113.99')).status).toBe(429)
    expect((await login('fresh@example.kz', 'wrong-password', '198.51.100.8')).status).toBe(401)
  })
})
