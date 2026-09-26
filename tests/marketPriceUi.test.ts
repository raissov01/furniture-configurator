/** Нарық бағасының UI белгілері: ескертпе, «рыночная / своя», «вернуть». */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarketPriceNotice, MarketPriceTag, marketResetPatch } from '../components/MarketPrice'
import { defaultShop } from '../lib/defaults'
import { en } from '../lib/locales/en'
import { kk } from '../lib/locales/kk'
import { uz } from '../lib/locales/uz'
import { defaultShopProfile, priceOrigin, starterShopProfile, syncActivePriceList } from '../src/core/index'
import type { ShopProfile } from '../src/core/index'

const noop = () => {}
const notice = (shop: ShopProfile) => renderToString(createElement(MarketPriceNotice, { shop, editShop: noop }))
const tag = (shop: ShopProfile, priceKey: string) =>
  renderToString(createElement(MarketPriceTag, { shop, priceKey, editShop: noop }))

const ownLdsp = (shop: ShopProfile) => syncActivePriceList({
  ...shop, materials: shop.materials.map((m) => m.id === 'ldsp16-w980' ? { ...m, pricePerSheet: 2_500_000 } : m),
})

describe('нарық бағасының ескертпесі', () => {
  it('жаңа цех (қолданбаның әдепкі профилі) нарық бағасымен ашылады', () => {
    expect(priceOrigin(defaultShop, 'material:ldsp16-w980')).toBe('market')
  })

  it('нарық позициясы бар цехта күнімен ескертеді', () => {
    const html = notice(starterShopProfile())
    expect(html).toContain('Цены — рыночная медиана (24.09.2026). Введите свои цены.')
    expect(html).toContain('Вернуть все рыночные цены')
  })

  it('нарық белгісі жоқ цехта ескертпе жоқ', () => {
    expect(notice(defaultShopProfile())).toBe('')
  })
})

describe('позицияның белгісі', () => {
  it('нарықтағы баға: «рыночная», медиана, күні, ұсыныс саны', () => {
    const html = tag(starterShopProfile(), 'material:ldsp16-w980')
    expect(html).toContain('рыночная')
    expect(html).toContain('медиана, 24.09.2026, 7 предложений')
  })

  it('өз бағасы: «своя» және нарыққа қайтару батырмасы', () => {
    const html = tag(ownLdsp(starterShopProfile()), 'material:ldsp16-w980')
    expect(html).toContain('своя')
    expect(html).toContain('Вернуть рыночную цену')
  })

  it('нарық дерегі жоқ позицияда белгі жоқ', () => {
    expect(tag(starterShopProfile(), 'material:ldsp18-w980')).toBe('')
  })

  it('қайтару патчы бағаны да, белгіні де қайтарады', () => {
    const own = ownLdsp(starterShopProfile())
    const patch = marketResetPatch(own, 'material:ldsp16-w980')
    const back = syncActivePriceList({ ...own, ...patch })
    expect(back.materials.find((m) => m.id === 'ldsp16-w980')!.pricePerSheet).toBe(2_687_000)
    expect(priceOrigin(back, 'material:ldsp16-w980')).toBe('market')
  })
})

describe('аударма', () => {
  it('жаңа жолдар төрт тілде бар', () => {
    const keys = [
      'Цены — рыночная медиана ({date}). Введите свои цены.',
      'Рыночных позиций: {n}. Изменённая цена становится вашей и при обновлении рыночных данных не перезаписывается.',
      'Вернуть все рыночные цены',
      'Все позиции, для которых есть рыночные данные, получат рыночную медиану — ваши цены по ним будут заменены. Продолжить?',
      'рыночная',
      'своя',
      'Вернуть рыночную цену',
      '{label}: медиана, {date}, {n} предложений',
      'Вернуть рыночную цену: {price}',
      'Цена изменена цехом — рыночные обновления её не трогают',
    ]
    for (const dict of [kk, en, uz]) {
      for (const key of keys) expect(dict[key], key).toBeTruthy()
    }
    expect(kk['Цены — рыночная медиана ({date}). Введите свои цены.'])
      .toBe('Бағалар — нарық орташасы (медиана, {date}). Өз бағаңызды енгізіңіз.')
  })
})
