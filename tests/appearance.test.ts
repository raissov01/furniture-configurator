/**
 * Көрініс баптаулары: тема мен 3D сапасы.
 *
 * Бұлар — адамның ыңғайы, сондықтан жобаға жазылмайды. Тест дәл сол
 * шекараны әрі 3D-нің «үнемді» режимінің шынымен жеңілдететінін күзетеді.
 */
import { describe, expect, it } from 'vitest'
import { QUALITIES, THEMES, canvasSettings } from '../lib/appearance'

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
