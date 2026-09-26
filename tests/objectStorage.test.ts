import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiskObjectStorage } from '../lib/server/objectStorage'

describe('tenant object storage', () => {
  it('keeps the same object key isolated by shop and preserves content type', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fc-objects-'))
    try {
      const storage = new DiskObjectStorage(root)
      const key = await storage.put('shop-a', 'photo', new Uint8Array([0, 255]), 'image/png')
      expect(await storage.get('shop-b', key)).toBeNull()
      expect(await storage.get('shop-a', key)).toEqual({ bytes: Buffer.from([0, 255]), contentType: 'image/png' })
      await expect(storage.get('../shop-a', key)).rejects.toThrow('жарамсыз')
      await storage.delete('shop-a', key)
      expect(await storage.get('shop-a', key)).toBeNull()
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
