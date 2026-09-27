import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-ai-access-'))
process.env['OPENAI_API_KEY'] = 'test-key'
const actor = vi.hoisted(() => ({ value: null as null | { userId: string; shopId: string; role: 'owner' | 'designer' | 'shop' | 'client' } }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.value }))
vi.mock('openai', () => ({ default: class {
  images = { edit: async () => ({ data: [{ b64_json: 'aGVsbG8=' }] }) }
  responses = { create: async () => ({ output_text: '{}' }) }
} }))

type Route = { POST: (request: Request) => Promise<Response> }
let routes: Record<string, Route>
beforeAll(async () => {
  routes = {
    render: await import('../app/api/render/route'),
    generate: await import('../app/api/generate/route'),
    variants: await import('../app/api/variants/route'),
    'v1-render': await import('../app/api/v1/render/route'),
    'v1-generate': await import('../app/api/v1/generate/route'),
    'v1-variants': await import('../app/api/v1/variants/route'),
  }
}, 30_000)

const request = (kind: string) => new Request(`http://localhost/api/${kind}`, { method: 'POST',
  body: JSON.stringify(kind.includes('render') ? { image: 'data:image/png;base64,aGVsbG8=' } : { prompt: 'Шкаф' }) })

describe('OpenAI маршруттарының рұқсаты', () => {
  it.each(['render', 'generate', 'variants', 'v1-render', 'v1-generate', 'v1-variants'])('%s 401/403 қайтарады', async (kind) => {
    actor.value = null
    const denied = await routes[kind]!.POST(request(kind))
    expect(denied.status).toBe(401)
    expect((await denied.json() as { error: string }).error).toMatch(/вход/i)
    actor.value = { userId: 'u1', shopId: 'shop-roles', role: 'shop' }
    const forbidden = await routes[kind]!.POST(request(kind))
    expect(forbidden.status).toBe(403)
  })

  it('рендерді цех бойынша сағатына төрт сұраумен шектейді', async () => {
    actor.value = { userId: 'u1', shopId: 'shop-limit', role: 'owner' }
    for (let i = 0; i < 4; i += 1) expect((await routes.render!.POST(request('render'))).status).toBe(200)
    const limited = await routes.render!.POST(request('render'))
    expect(limited.status).toBe(429)
    expect((await limited.json() as { error: string }).error).toMatch(/лимит/i)
    expect((await routes['v1-render']!.POST(request('v1-render'))).status).toBe(429)
    actor.value = { userId: 'u2', shopId: 'other-shop', role: 'designer' }
    expect((await routes.render!.POST(request('render'))).status).toBe(200)
  })
})
