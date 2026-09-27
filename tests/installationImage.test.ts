import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { validateInstallationImage } from '../lib/server/installationImage'

const image = async (rgba: Uint8Array, format: 'png' | 'jpeg' = 'png') => {
  const source = sharp(rgba, { raw: { width: 4, height: 4, channels: 4 } })
  const bytes = format === 'png' ? await source.png().toBuffer() : await source.jpeg().toBuffer()
  return `data:image/${format};base64,${bytes.toString('base64')}`
}

describe('монтаж суретінің серверлік тексеруі', () => {
  it('үзік файл мен бос қолтаңбаны қабылдамайды', async () => {
    await expect(validateInstallationImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', 'photo')).rejects.toThrow()
    await expect(validateInstallationImage('data:image/jpeg;base64,/9j/2Q==', 'photo')).rejects.toThrow()
    await expect(validateInstallationImage(await image(new Uint8Array(4 * 4 * 4)), 'signature')).rejects.toThrow(/қол/i)
    await expect(validateInstallationImage(await image(Uint8Array.from({ length: 4 * 4 * 4 }, (_, i) => i % 4 === 3 ? 255 : 255)), 'signature')).rejects.toThrow(/қол/i)
  })

  it('оқылатын фото мен нақты сызығы бар қолтаңбаны қабылдайды', async () => {
    const pixels = Uint8Array.from({ length: 4 * 4 * 4 }, (_, i) => i % 4 === 3 ? 255 : 255)
    for (let i = 0; i < 16; i += 4) { pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0 }
    await expect(validateInstallationImage(await image(pixels), 'signature')).resolves.toBeUndefined()
    await expect(validateInstallationImage(await image(pixels, 'jpeg'), 'photo')).resolves.toBeUndefined()
  })
})
