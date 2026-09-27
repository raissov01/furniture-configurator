import { describe, expect, it } from 'vitest'
import { validateCatalogImage } from '@/lib/server/catalogImage'

describe('цех текстура суреті', () => {
  it('PNG қолтаңбасын ғана PNG деп қабылдайды', () => {
    expect(validateCatalogImage(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]), 'image/png')).toBe('png')
    expect(() => validateCatalogImage(new Uint8Array([1, 2, 3]), 'image/png')).toThrow()
  })
  it('бос не шектен асқан файлды қабылдамайды', () => {
    expect(() => validateCatalogImage(new Uint8Array(), 'image/jpeg')).toThrow()
    const oversized = new Uint8Array(1_000_001)
    oversized.set([137, 80, 78, 71, 13, 10, 26, 10])
    expect(() => validateCatalogImage(oversized, 'image/png')).toThrow()
  })
})
