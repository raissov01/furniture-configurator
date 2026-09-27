import { describe, expect, it } from 'vitest'
import { parsePbrDraft, visualNumber } from '../lib/f28VisualUi'

describe('F28 visual UI', () => {
  it('reports PBR field ranges and required normal map dimensions', () => {
    const base = { roughness: '', metalness: '', reflection: '', opacity: '', normalUrl: '', normalX: '', normalY: '', normalStrength: '' }
    expect(parsePbrDraft({ ...base, roughness: '2' }).errors.roughness).toContain('0..1')
    const normal = parsePbrDraft({ ...base, normalUrl: 'https://example.com/n.png' })
    expect(normal.errors.normalX).toContain('> 0')
    expect(normal.errors.normalY).toContain('> 0')
    expect(parsePbrDraft({ ...base, roughness: '0.5' }).pbr?.roughness).toBe(0.5)
  })
  it('keeps empty and negative intensity from reaching the store', () => {
    expect(visualNumber('', 'Интенсивность', 0, 100).error).toContain('0..100')
    expect(visualNumber('-1', 'Интенсивность', 0, 100).error).toContain('0..100')
    expect(visualNumber('5', 'Интенсивность', 0, 100).value).toBe(5)
  })
})
