import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareMeasurementPhoto } from '../lib/mobile/photo'

afterEach(() => vi.unstubAllGlobals())

describe('phone photo preparation', () => {
  it('reduces the long side to 2048 px and encodes JPEG at 0.8', async () => {
    const close = vi.fn()
    const drawImage = vi.fn()
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }),
      toBlob: (callback: (result: Blob) => void, type: string, quality: number) => {
        expect(type).toBe('image/jpeg')
        expect(quality).toBe(0.8)
        callback(new Blob(['compressed'], { type }))
      } }
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4096, height: 2048, close }))
    vi.stubGlobal('document', { createElement: () => canvas })
    const result = await prepareMeasurementPhoto(new File(['large'], 'room.png', { type: 'image/png' }))
    expect([canvas.width, canvas.height]).toEqual([2048, 1024])
    expect(result.type).toBe('image/jpeg')
    expect(drawImage).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('rejects a still oversized encoded image with a useful error', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close: () => undefined }))
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toBlob: (callback: (result: Blob) => void) => callback(new Blob([new Uint8Array(8_000_001)])),
    }) })
    await expect(prepareMeasurementPhoto(new File(['x'], 'room.png', { type: 'image/png' })))
      .rejects.toThrow(/8 МБ/)
  })
})
