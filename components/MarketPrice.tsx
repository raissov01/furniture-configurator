'use client'

/**
 * НАРЫҚ БАҒАСЫНЫҢ БЕЛГІЛЕРІ (`src/core/marketPrices.ts`).
 *
 * Жаңа цехтың бағасы — ашық ұсыныстардың медианасы. Цех оны бағдар ретінде
 * көруі керек: смета мен прайс панелінде ескертпе, әр позицияда «рыночная»
 * не «своя» белгісі және нарық бағасына қайтару батырмасы.
 */
import { t as tr, tf } from '@/lib/i18n'
import {
  formatTengeExact, marketPricedCount, marketQuote, priceOrigin, resetAllToMarket, resetToMarket,
} from '@/src/core/index'
import type { PriceKey, ShopProfile } from '@/src/core/index'

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

/** «Цены — рыночная медиана (24.09.2026). Введите свои цены.» + «вернуть все». */
export function MarketPriceNotice({ shop, editShop }: { shop: ShopProfile; editShop?: EditShop | undefined }) {
  const count = marketPricedCount(shop)
  if (count === 0) return null
  const date = Object.values(shop.marketPrices)[0]?.dateSeen ?? ''
  return (
    <div className={`${notice} flex flex-wrap items-center gap-2`}>
      <span className="min-w-0 flex-1">
        <strong>{tf('Цены — рыночная медиана ({date}). Введите свои цены.', { date: marketDate(date) })}</strong>{' '}
        {tf('Рыночных позиций: {n}. Изменённая цена становится вашей и при обновлении рыночных данных не перезаписывается.', { n: count })}
      </span>
      {editShop ? (
        <button
          type="button"
          className="rounded-md border border-sky-400 px-2 py-0.5 font-medium hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
          onClick={() => {
            if (window.confirm(tr('Все позиции, для которых есть рыночные данные, получат рыночную медиану — ваши цены по ним будут заменены. Продолжить?'))) {
              editShop(pricePatch(resetAllToMarket(shop)))
            }
          }}
        >
          {tr('Вернуть все рыночные цены')}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Позицияның белгісі прайс кестесінде. Нарық дерегі жоқ позицияда ештеңе
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
  const detail = tf('{label}: медиана, {date}, {n} предложений', {
    label: quote.label, date: marketDate(quote.dateSeen), n: quote.offers,
  })
  if (origin === 'market') {
    return (
      <span title={detail}
        className="whitespace-nowrap rounded border border-sky-300 px-1 text-[10px] text-sky-800 dark:border-sky-800 dark:text-sky-300">
        {tr('рыночная')}
      </span>
    )
  }
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
        aria-label={tr('Вернуть рыночную цену')}
        title={`${tf('Вернуть рыночную цену: {price}', { price: formatTengeExact(quote.priceTiyn) })}\n${detail}`}
        className="rounded border border-neutral-300 px-1 text-[10px] hover:border-sky-500 dark:border-neutral-700"
        onClick={() => editShop(marketResetPatch(shop, priceKey))}
      >
        ↺
      </button>
    </span>
  )
}
