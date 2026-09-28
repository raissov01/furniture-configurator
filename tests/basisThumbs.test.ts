import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { extractEmbeddedPng, moduleKey, previewAssetName, privateOutputAllowed } from '../scripts/basisThumbs.mjs'

const sample = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ5kAAAAASUVORK5CYII=', 'base64')

describe('Базис нобайы', () => {
  it('стандарт PNG бөлігін басқа байттардың арасынан алады', () => {
    const embedded = Buffer.concat([Buffer.from('opaque-prefix'), sample, Buffer.from('suffix')])
    expect(extractEmbeddedPng(embedded)).toEqual(sample)
    expect(extractEmbeddedPng(Buffer.from('no thumbnail'))).toBeNull()
  })
  it('фурнитураны public каталогына жаздырмайды', () => {
    expect(privateOutputAllowed('/repo/public/library/basis', '/repo/public')).toBe(false)
    expect(privateOutputAllowed('/repo/private-shop', '/repo/public')).toBe(true)
  })
  it('жүйе мен атауды тұрақты кілтке, мазмұнды тұрақты файлға айналдырады', () => {
    expect(moduleKey('standard', ' ШН720х560х600.b3d ')).toBe('standard/ШН720х560х600')
    expect(moduleKey('gola', 'ШН720х560х600')).toBe('gola/ШН720х560х600')
    expect(previewAssetName(sample)).toBe(`${createHash('sha256').update(sample).digest('hex').slice(0, 20)}.webp`)
  })
})
