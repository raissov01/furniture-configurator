/**
 * Декорлар кітапханасы.
 *
 * Кітапхана — ТАҢДАУ ҮШІН тізім, цехтың профиліне тек өзі қосқаны түседі.
 * Сондықтан мұнда тексерілетіні: тізімнің тұтастығы (id қайталанбайды),
 * іздеудің жұмысы әрі түстің пішіні — 3D сол түстен рендерленеді.
 */
import { describe, expect, it } from 'vitest'
import { DECOR_BRANDS, DECOR_LIBRARY, findDecor, searchDecors } from '../src/core/index'

describe('кітапхана', () => {
  it('бес жүзден астам декор бар', () => {
    expect(DECOR_LIBRARY.length).toBeGreaterThan(500)
  })

  it('id ҚАЙТАЛАНБАЙДЫ: материал соған байланады', () => {
    const ids = DECOR_LIBRARY.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('әр декордың аты бар, түсі HEX', () => {
    for (const d of DECOR_LIBRARY) {
      expect(d.name.length, d.id).toBeGreaterThan(2)
      expect(d.color, d.id).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('брендтер тізімінде негізгі жеткізушілер бар', () => {
    expect(DECOR_BRANDS).toEqual(expect.arrayContaining(['Egger', 'Kronospan', 'Cleaf']))
  })

  it('ағаш декорда ТЕКСТУРА белгіленген (раскрой оны бұрмайды)', () => {
    const oak = DECOR_LIBRARY.filter((d) => /дуб/i.test(d.name))
    expect(oak.length).toBeGreaterThan(20)
    expect(oak.every((d) => d.hasGrain)).toBe(true)
  })

  it('БІРТҮСТІ ақ декорда текстура жоқ, ал АҚ АҒАШТА бар', () => {
    // ⚠ «Ақ» деген сөз әлі біртүсті дегенді білдірмейді: «Сосна Аланд белая»
    // — ағаш, оның текстурасы бар әрі раскройда бұрылмайды.
    const wood = /дуб|орех|сосн|ясен|бук|клён|клен|вяз|ольх/i
    const plainWhite = DECOR_LIBRARY.filter((d) => /бел(ый|ая)/i.test(d.name) && !wood.test(d.name))
    expect(plainWhite.length).toBeGreaterThan(3)
    expect(plainWhite.every((d) => !d.hasGrain)).toBe(true)

    const whiteWood = DECOR_LIBRARY.filter((d) => /бел(ый|ая)/i.test(d.name) && wood.test(d.name))
    expect(whiteWood.every((d) => d.hasGrain)).toBe(true)
  })
})

describe('іздеу', () => {
  it('атауы мен артикулы бойынша табады', () => {
    expect(searchDecors('H1145').length).toBeGreaterThan(0)
    expect(searchDecors('дуб').length).toBeGreaterThan(10)
  })

  it('БІРНЕШЕ сөз бірге тексеріледі', () => {
    const found = searchDecors('egger дуб')
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((d) => /egger/i.test(d.brand) && /дуб/i.test(d.name))).toBe(true)
  })

  it('брендпен сүзіледі әрі шектеу сақталады', () => {
    const found = searchDecors('', 'Kronospan', 5)
    expect(found).toHaveLength(5)
    expect(found.every((d) => d.brand === 'Kronospan')).toBe(true)
  })

  it('id бойынша табылады', () => {
    const first = DECOR_LIBRARY[0]!
    expect(findDecor(first.id)?.name).toBe(first.name)
    expect(findDecor('жоқ-декор')).toBeUndefined()
  })
})
