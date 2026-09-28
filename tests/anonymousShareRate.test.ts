import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

process.env['DATA_DIR'] = mkdtempSync(join(tmpdir(), 'furniture-share-limit-'))
vi.mock('@/lib/server/cloud', () => ({ cloudOff: () => null }))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => null }))

let route: typeof import('../app/api/share/route')
let codeRoute: typeof import('../app/api/share/[code]/route')
let body: string
beforeAll(async () => {
  const core = await import('../src/core/index')
  body = JSON.stringify(core.migrateV3ToV4({ schemaVersion: 3, name: 'Жоба',
    materials: core.SEED_CATALOG.materials, edgeBands: core.SEED_CATALOG.edgeBands,
    cabinets: [], placements: [], room: { width: 4000, depth: 3000, height: 2700 } }))
  route = await import('../app/api/share/route')
  codeRoute = await import('../app/api/share/[code]/route')
}, 30_000)

describe('anonymous share creation rate', () => {
  it('rejects a bad author key before reading the update body', async () => {
    const { createShare } = await import('../lib/server/share')
    const code = createShare(body).code
    let read = false
    const stream = new ReadableStream<Uint8Array>({ pull(controller) {
      read = true
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    } }, { highWaterMark: 0 })
    const response = await codeRoute.PUT(new Request(`http://localhost/api/share/${code}`, {
      method: 'PUT', body: stream, duplex: 'half', headers: { 'x-share-key': 'bad-key' },
    } as RequestInit), { params: Promise.resolve({ code }) })
    expect(response.status).toBe(404)
    expect(read).toBe(false)
  })

  it('stops reading an oversized streamed project at the byte limit', async () => {
    let cancelled = false
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        if (pulls === 1) controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1))
        else if (pulls === 2) controller.enqueue(new Uint8Array([1]))
        else controller.close()
      },
      cancel() { cancelled = true },
    })
    const response = await route.POST(new Request('http://localhost/api/share', {
      method: 'POST', body: stream, duplex: 'half',
    } as RequestInit))
    expect(response.status).toBe(413)
    expect(cancelled).toBe(true)
  })

  it('limits new persistent codes from the same source', async () => {
    const post = () => route.POST(new Request('http://localhost/api/share', { method: 'POST', body,
      headers: { 'x-real-ip': '198.51.100.47' } }))
    const statuses: number[] = []
    for (let i = 0; i < 10; i += 1) statuses.push((await post()).status)
    expect(statuses).toEqual(Array(10).fill(200))
    let read = false
    const stream = new ReadableStream<Uint8Array>({ pull(controller) {
      read = true
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    } }, { highWaterMark: 0 })
    const rejected = await route.POST(new Request('http://localhost/api/share', { method: 'POST', body: stream,
      duplex: 'half', headers: { 'x-real-ip': '198.51.100.47' } } as RequestInit))
    expect(rejected.status).toBe(429)
    expect(read).toBe(false)
  })
})
