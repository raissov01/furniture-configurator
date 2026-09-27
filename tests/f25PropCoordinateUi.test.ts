import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parsePropCoordinate } from '@/lib/propCoordinateUi'

describe('F25 каталогтағы декор координатасы', () => {
  it('бос, мәтін және бөлшек мәнді қабылдамайды', () => {
    for (const raw of ['', '  ', 'abc', '1.5', '2e3']) {
      const result = parsePropCoordinate(raw, 'X')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/X.*диапазоне/)
    }
  })
  it('теріс бүтін миллиметрді сақтайды', () => {
    expect(parsePropCoordinate('-25', 'Z')).toEqual({ ok: true, value: -25 })
  })
  it('каталог бос өрісті жазбайды және жарамсыз жобаны орналастырмайды', () => {
    const source = readFileSync(new URL('../components/panels/LibraryPanel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('parsePropCoordinate(raw, axis.toUpperCase())')
    expect(source).toContain("Object.keys(coordErrors).some((key) => key.startsWith('new:'))")
    expect(source).not.toContain('Number(event.target.value)')
  })
})
