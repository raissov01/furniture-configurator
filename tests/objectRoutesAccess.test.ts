import { describe, expect, it, vi } from 'vitest'

const actor = vi.hoisted(() => ({ role: 'client' as 'client' | 'shop' | 'designer' }))
const storage = vi.hoisted(() => ({
  put: vi.fn(async () => 'photo/example'),
  get: vi.fn(async () => ({ bytes: new Uint8Array([1]), contentType: 'image/png' })),
  delete: vi.fn(async () => undefined),
}))
vi.mock('@/lib/server/session', () => ({ currentAccount: async () => ({ role: actor.role, shopId: 'shop-1' }) }))
vi.mock('@/lib/server/objectStorage', () => ({ objectStorage: () => storage }))

const context = (kind: string) => ({ params: Promise.resolve({ kind, id: 'example' }) })

describe('object storage route roles', () => {
  it('keeps a client from uploading, reading, or deleting shop files', async () => {
    actor.role = 'client'
    const collection = await import('../app/api/v1/objects/[kind]/route')
    const item = await import('../app/api/v1/objects/[kind]/[id]/route')
    expect((await collection.POST(new Request('http://localhost', { method: 'POST', body: 'png' }), context('photo'))).status).toBe(403)
    expect((await item.GET(new Request('http://localhost'), context('photo'))).status).toBe(403)
    expect((await item.DELETE(new Request('http://localhost', { method: 'DELETE' }), context('photo'))).status).toBe(403)
    expect(storage.put).not.toHaveBeenCalled()
    expect(storage.get).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('keeps the installer photo exception and editor access', async () => {
    const collection = await import('../app/api/v1/objects/[kind]/route')
    const item = await import('../app/api/v1/objects/[kind]/[id]/route')
    actor.role = 'shop'
    expect((await collection.POST(new Request('http://localhost', { method: 'POST', body: 'png' }), context('photo'))).status).toBe(201)
    expect((await item.GET(new Request('http://localhost'), context('photo'))).status).toBe(200)
    expect((await collection.POST(new Request('http://localhost', { method: 'POST', body: 'png' }), context('render'))).status).toBe(403)
    expect((await item.DELETE(new Request('http://localhost', { method: 'DELETE' }), context('photo'))).status).toBe(403)
    actor.role = 'designer'
    expect((await item.DELETE(new Request('http://localhost', { method: 'DELETE' }), context('photo'))).status).toBe(200)
  })
})
