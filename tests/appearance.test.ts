/**
 * Көрініс баптаулары: тема мен 3D сапасы.
 *
 * Бұлар — адамның ыңғайы, сондықтан жобаға жазылмайды. Тест дәл сол
 * шекараны әрі 3D-нің «үнемді» режимінің шынымен жеңілдететінін күзетеді.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QUALITIES, THEMES, canvasSettings, readQuality } from '../lib/appearance'

/** Node ортасында `window` жоқ — әр тестке керегінше өзіміз қоямыз. */
function stubWindow(opts: { saved?: string | null; coarsePointer?: boolean }): void {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => opts.saved ?? null,
    },
    matchMedia: (query: string) => ({
      matches: query === '(pointer: coarse)' ? (opts.coarsePointer ?? false) : false,
    }),
  })
}

describe('3D сапасы', () => {
  it('«үнемді» режим пиксель тығыздығын да, тегістеуді де түсіреді', () => {
    expect(canvasSettings('low')).toEqual({ dpr: [1, 1], antialias: false })
  })

  it('сапа өскен сайын тығыздық та өседі', () => {
    const max = (q: (typeof QUALITIES)[number]) => canvasSettings(q).dpr[1]
    expect(max('low')).toBeLessThan(max('medium'))
    expect(max('medium')).toBeLessThan(max('high'))
  })

  it('әдепкі (максимум) бұрынғы мінезбен бірдей: dpr [1, 2]', () => {
    expect(canvasSettings('high').dpr).toEqual([1, 2])
  })
})

describe('тема', () => {
  it('үш күй бар әрі «жүйедегідей» солардың бірі', () => {
    expect(THEMES).toEqual(['system', 'light', 'dark'])
  })
})

describe('әдепкі 3D сапасы (§6 — телефонда түсіру)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('сақталған таңдау болса — құрылғыға қарамай соны қайтарады', () => {
    stubWindow({ saved: 'low', coarsePointer: true })
    expect(readQuality()).toBe('low')
  })

  it('сақталған таңдау ЖОҚ, тач-экран (coarse pointer) — «орта» сапа', () => {
    stubWindow({ saved: null, coarsePointer: true })
    expect(readQuality()).toBe('medium')
  })

  it('сақталған таңдау ЖОҚ, тінтуір (fine pointer) — бұрынғыдай «максимум»', () => {
    stubWindow({ saved: null, coarsePointer: false })
    expect(readQuality()).toBe('high')
  })
})
