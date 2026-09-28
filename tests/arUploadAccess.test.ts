import { existsSync, mkdtempSync, readdirSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-ar-access-'))
const actor = vi.hoisted(() => ({ role: null as 'owner' | 'designer' | 'shop' | 'client' | null }))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => actor.role && ({ role: actor.role }) }))

let route: typeof import('../app/api/ar/route')
let readRoute: typeof import('../app/api/ar/[id]/route')
beforeAll(async () => {
  route = await import('../app/api/ar/route')
  readRoute = await import('../app/api/ar/[id]/route')
})

describe('AR upload access', () => {
  const upload = () => route.POST(new Request('http://localhost/api/ar', { method: 'POST', body: 'glTF' }))

  it('requires a project editor before accepting or persisting an upload', async () => {
    for (const role of [null, 'shop', 'client'] as const) {
      actor.role = role
      expect((await upload()).status).toBe(role === null ? 401 : 403)
    }
    const dir = join(process.env['DATA_DIR']!, 'ar')
    expect(existsSync(dir) ? readdirSync(dir) : []).toHaveLength(0)
    actor.role = 'designer'
    expect((await upload()).status).toBe(200)
  })

  it('cancels an upload stream as soon as it exceeds 25 MiB', async () => {
    actor.role = 'designer'
    let cancelled = false
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        if (pulls === 1) controller.enqueue(new Uint8Array(25 * 1024 * 1024 + 1))
        else if (pulls === 2) controller.enqueue(new Uint8Array([1]))
        else controller.close()
      },
      cancel() { cancelled = true },
    })
    const response = await route.POST(new Request('http://localhost/api/ar', {
      method: 'POST', body: stream, duplex: 'half',
    } as RequestInit))
    expect(response.status).toBe(413)
    expect(cancelled).toBe(true)
  })

  it('stops serving a file after the advertised one-hour lifetime', async () => {
    actor.role = 'designer'
    const result = await upload()
    const { id } = await result.json() as { id: string }
    const path = join(process.env['DATA_DIR']!, 'ar', `${id}.glb`)
    const live = await readRoute.GET(new Request(`http://localhost/api/ar/${id}`),
      { params: Promise.resolve({ id }) })
    expect(live.status).toBe(200)
    expect(live.headers.get('Cache-Control')).toContain('no-store')
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000)
    utimesSync(path, old, old)
    const response = await readRoute.GET(new Request(`http://localhost/api/ar/${id}`),
      { params: Promise.resolve({ id }) })
    expect(response.status).toBe(404)
    expect(existsSync(path)).toBe(false)
  })
})
