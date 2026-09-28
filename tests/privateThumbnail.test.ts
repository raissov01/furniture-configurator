import { describe, expect, it } from 'vitest'
import { privateThumbnailUrl, privateThumbnailFromFile } from '../lib/privateThumbnail'

describe('цехтың жеке нобайы', () => {
  it('жеке кітапханадағы PNG/WebP дерегін ғана көрсетеді', () => {
    expect(privateThumbnailUrl('data:image/png;base64,aGVsbG8=')).toBe('data:image/png;base64,aGVsbG8=')
    expect(privateThumbnailUrl('data:image/webp;base64,aGVsbG8=')).toBe('data:image/webp;base64,aGVsbG8=')
    expect(privateThumbnailUrl('https://elsewhere.test/hardware.png')).toBeNull()
    expect(privateThumbnailUrl('data:image/svg+xml;base64,aGVsbG8=')).toBeNull()
  })
  it('файлды жеке LibraryItem үшін ықшам data URL-ге айналдырады', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'preview.webp', { type: 'image/webp' })
    expect(await privateThumbnailFromFile(file)).toBe('data:image/webp;base64,AQID')
    await expect(privateThumbnailFromFile(new File([new Uint8Array(48_001)], 'large.webp', { type: 'image/webp' }))).rejects.toThrow('48 КБ')
  })
})
