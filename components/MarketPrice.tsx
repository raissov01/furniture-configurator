'use client'

/**
 * НАРЫҚ БАҒАСЫНЫҢ БЕЛГІЛЕРІ (`src/core/marketPrices.ts`).
 *
 * Жаңа цехтың бағасы — ұсынылған баға, ол жоқ жерде ашық ұсыныстардың
 * медианасы. Цех оны бағдар ретінде көруі керек: смета мен прайс панелінде
 * ескертпе, әр позицияда «Рекомендуемая цена (дата)» / «рыночная» не «своя»
 * белгісі және әдепкі бағаға қайтару батырмасы. Ұсынылған бағаның
 * дереккөзінің аты UI-да КӨРСЕТІЛМЕЙДІ.
 */
import { t as tr, tf } from '@/lib/i18n'
import {
  RECOMMENDED_PRICE_SOURCE, formatTengeExact, marketPricedCount, marketQuote, priceOrigin, pruneMarketMarks,
  resetAllToMarket, resetToMarket,
} from '@/src/core/index'
import type { MarketQuote, PriceKey, ShopProfile } from '@/src/core/index'

type EditShop = (patch: Partial<ShopProfile>) => void

/** '2026-09-24' → '24.09.2026' */
export function marketDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

/** Ақшаға қатысты өрістер ғана — `editShop` қалғанына тимейді. */
function pricePatch(next: ShopProfile): Partial<ShopProfile> {
  return {
    materials: next.materials, edgeBands: next.edgeBands, hardware: next.hardware,
    services: next.services, marketPrices: next.marketPrices,
  }
}

export function marketResetPatch(shop: ShopProfile, key: PriceKey): Partial<ShopProfile> {
  return pricePatch(resetToMarket(shop, key))
}

const notice =
  'rounded-md border border-sky-300 bg-sky-50 px-2.5 py-2 text-[11px] text-sky-900 ' +
  'dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200'

/** «Цены по умолчанию — рекомендуемые (26.09.2026) и рыночная медиана.» + «вернуть все». */
export function MarketPriceNotice({ shop, editShop }: { shop: ShopProfile; editShop?: EditShop | undefined }) {
  const count = marketPricedCount(shop)
  if (count === 0) return null
  const marks = Object.values(pruneMarketMarks(shop).marketPrices)
  const recommended = marks.find((m) => m.source === RECOMMENDED_PRICE_SOURCE)
  const headline = recommended
    ? tf('Цены по умолчанию — рекомендуемые ({date}) и рыночная медиана. Введите свои цены.', {
        date: marketDate(recommended.dateSeen),
      })
    : tf('Цены — рыночная медиана ({date}). Введите свои цены.', { date: marketDate(marks[0]?.dateSeen ?? '') })
  return (
    <div className={`${notice} flex flex-wrap items-center gap-2`}>
      <span className="min-w-0 flex-1">
        <strong>{headline}</strong>{' '}
        {tf('Рыночных позиций: {n}. Изменённая цена становится вашей и при обновлении рыночных данных не перезаписывается.', { n: count })}
      </span>
      {editShop ? (
        <button
          type="button"
          className="rounded-md border border-sky-400 px-2 py-0.5 font-medium hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
          onClick={() => {
            if (window.confirm(tr('Все позиции с рекомендуемой или рыночной ценой получат её — ваши цены по ним будут заменены. Продолжить?'))) {
              editShop(pricePatch(resetAllToMarket(shop)))
            }
          }}
        >
          {tr('Вернуть цены по умолчанию')}
        </button>
      ) : null}
    </div>
  )
}

/** Нарық медианасы — салыстыру үшін (тек нарық тобы бар позицияда). */
function marketDetail(quote: MarketQuote): string {
  return quote.market
    ? tf('{label}: медиана, {date}, {n} предложений', {
        label: quote.market.label, date: marketDate(quote.market.dateSeen), n: quote.market.offers,
      })
    : ''
}

/**
 * Позицияның белгісі прайс кестесінде. Әдепкі дерегі жоқ позицияда ештеңе
 * көрсетілмейді — оның бағасын тек цех біледі.
 */
export function MarketPriceTag({ shop, priceKey, editShop }: {
  shop: ShopProfile
  priceKey: PriceKey
  editShop: EditShop
}) {
  const quote = marketQuote(priceKey)
  if (!quote) return null
  const origin = priceOrigin(shop, priceKey)
  const detail = marketDetail(quote)
  if (origin === 'market') {
    const mark = shop.marketPrices[priceKey]
    const recommended = mark?.source === RECOMMENDED_PRICE_SOURCE
    const text = recommended
      ? tf('Рекомендуемая цена ({date})', { date: marketDate(mark.dateSeen) })
      : tr('рыночная')
    return (
      <span title={detail || undefined}
        className="whitespace-nowrap rounded border border-sky-300 px-1 text-[10px] text-sky-800 dark:border-sky-800 dark:text-sky-300">
        {text}
      </span>
    )
  }
  const recommended = quote.source === RECOMMENDED_PRICE_SOURCE
  const resetLabel = recommended ? tr('Вернуть рекомендуемую цену') : tr('Вернуть рыночную цену')
  const resetTitle = recommended
    ? tf('Вернуть рекомендуемую цену: {price}', { price: formatTengeExact(quote.priceTiyn) })
    : tf('Вернуть рыночную цену: {price}', { price: formatTengeExact(quote.priceTiyn) })
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {origin === 'own' ? (
        <span title={tr('Цена изменена цехом — рыночные обновления её не трогают')}
          className="rounded border border-neutral-300 px-1 text-[10px] text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          {tr('своя')}
        </span>
      ) : null}
      <button
        type="button"
        aria-label={resetLabel}
        title={detail ? `${resetTitle}\n${detail}` : resetTitle}
        className="rounded border border-neutral-300 px-1 text-[10px] hover:border-sky-500 dark:border-neutral-700"
        onClick={() => editShop(marketResetPatch(shop, priceKey))}
      >
        ↺
      </button>
    </span>
  )
}
