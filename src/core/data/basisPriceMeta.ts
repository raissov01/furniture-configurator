/**
 * `basisCatalog.ts`-тегі әр материалдың баға сенімділігі.
 *
 * `Material`/`EdgeBand` типінде (`../types.ts`) баға дереккөзі өрісі ЖОҚ
 * (басқа агент иелейді, өзгертілмейді) — сондықтан бұл БӨЛЕК, қосымша
 * lookup-файл. Есеп-қисапқа (`pricing.ts`) ТІКЕЛЕЙ кірмейді, тек құжаттама
 * мен цехтың баға тексеруі үшін.
 */
import priceMetaData from './generated/basisPriceMeta.json'

export type BasisPriceSource =
  /** Базис-тегі баға пайдаланылмады, валютасы расталмаған. `pricePerSheet`/`pricePerMeter` = 0. */
  | 'unknown'
  /**
   * qdesign.kz-тен оқылған нақты ҚР бағасы (тиынмен), бірақ ДЕКОРҒА
   * БӨЛІНБЕГЕН — бір брендтің/форматтың жалпы бағасы. Цех нақтылауы керек.
   */
  | 'kz-quoted-generic'

export type BasisPriceMetaEntry = {
  priceSource: BasisPriceSource
  /** Түсіндірме: бастапқы «Стоимость» мәні немесе баға көзі. */
  note: string
}

export const BASIS_PRICE_META: Record<string, BasisPriceMetaEntry> =
  priceMetaData as Record<string, BasisPriceMetaEntry>
