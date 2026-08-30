import { SEED_CATALOG, catalogOf, defaultShopProfile, findTemplate, templateToCabinet } from '@/src/core/index'
import type { CabinetConfig, Catalog, ShopProfile } from '@/src/core/index'

/**
 * Каталог енді ЦЕХТЫҢ профилінен келеді — код бір цехтың материалын да,
 * бағасын да білмейді. Мұндағы `catalog` тек бастапқы жүктеу үшін.
 */
export const defaultShop: ShopProfile = defaultShopProfile()

export const catalog: Catalog = SEED_CATALOG

/** Конфигуратор ашылғанда тұратын шаблон. */
export const defaultTemplateId = 'wardrobe-penal-600'

/**
 * CLAUDE.md §8.7 эталон шкафы. Ол бөлек жазылмайды — сол шаблонның өзі,
 * әйтпесе екеуі бір-бірінен алшақтап кетеді. Аты мен id-і ғана тарихи
 * қалпында қалды.
 */
export const defaultCabinet: CabinetConfig = {
  ...templateToCabinet(findTemplate(defaultTemplateId)!, catalogOf(defaultShop)),
  id: 'cabinet-1',
  name: 'Шкаф-пенал',
}
