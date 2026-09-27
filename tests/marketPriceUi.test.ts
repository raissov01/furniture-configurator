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

  it('жаңа цехта: ұсынылған баға күнімен және нарық медианасы', () => {
    const html = notice(starterShopProfile())
    expect(html).toContain('Цены по умолчанию — рекомендуемые (26.09.2026) и рыночная медиана. Введите свои цены.')
    expect(html).toContain('Вернуть цены по умолчанию')
    expect(html.toLowerCase()).not.toContain('qdesign')
  })

  it('тек нарық белгісі бар цехта — нарық медианасының күні', () => {
    const shop = starterShopProfile()
    const onlyMarket = { ...shop, marketPrices: { 'edgeBand:pvc04-w980': shop.marketPrices['edgeBand:pvc04-w980']! } }
    expect(notice(onlyMarket)).toContain('Цены — рыночная медиана (24.09.2026). Введите свои цены.')
  })

  it('нарық белгісі жоқ цехта ескертпе жоқ', () => {
    expect(notice(defaultShopProfile())).toBe('')
  })
})

describe('позицияның белгісі', () => {
  it('ұсынылған баға: «Рекомендуемая цена (26.09.2026)», нарық медианасы тек салыстыру ретінде', () => {
    const html = tag(starterShopProfile(), 'material:ldsp16-w980')
    expect(html).toContain('Рекомендуемая цена (26.09.2026)')
    expect(html).toContain('медиана, 24.09.2026, 7 предложений')
    expect(html.toLowerCase()).not.toContain('qdesign')
  })

  it('нарықтағы баға: «рыночная», медиана, күні, ұсыныс саны', () => {
    const html = tag(starterShopProfile(), 'edgeBand:pvc04-w980')
    expect(html).toContain('рыночная')
    expect(html).toContain('медиана, 24.09.2026, 2 предложений')
  })

  it('өз бағасы: «своя» және ұсынылған бағаға қайтару батырмасы', () => {
    const html = tag(ownLdsp(starterShopProfile()), 'material:ldsp16-w980')
    expect(html).toContain('своя')
    expect(html).toContain('Вернуть рекомендуемую цену')
    expect(html).toMatch(/34\s000/)
  })

  it('нарық дерегі жоқ позицияда белгі жоқ', () => {
    expect(tag(starterShopProfile(), 'material:ldsp18-w980')).toBe('')
  })

  it('қайтару патчы бағаны да, белгіні де қайтарады', () => {
    const own = ownLdsp(starterShopProfile())
    const patch = marketResetPatch(own, 'material:ldsp16-w980')
    const back = syncActivePriceList({ ...own, ...patch })
    expect(back.materials.find((m) => m.id === 'ldsp16-w980')!.pricePerSheet).toBe(3_400_000)
    expect(priceOrigin(back, 'material:ldsp16-w980')).toBe('market')
  })
})

describe('аударма', () => {
  it('жаңа жолдар төрт тілде бар', () => {
    const keys = [
      'Цены — рыночная медиана ({date}). Введите свои цены.',
      'Рыночных позиций: {n}. Изменённая цена становится вашей и при обновлении рыночных данных не перезаписывается.',
      'Вернуть цены по умолчанию',
      'Все позиции с рекомендуемой или рыночной ценой получат её — ваши цены по ним будут заменены. Продолжить?',
      'Цены по умолчанию — рекомендуемые ({date}) и рыночная медиана. Введите свои цены.',
      'Рекомендуемая цена ({date})',
      'Вернуть рекомендуемую цену',
      'Вернуть рекомендуемую цену: {price}',
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
    expect(kk['Рекомендуемая цена ({date})']).toBe('Ұсынылған баға ({date})')
    for (const dict of [kk, en, uz]) {
      for (const key of keys) expect(dict[key]!.toLowerCase(), key).not.toContain('qdesign')
    }
  })
})
