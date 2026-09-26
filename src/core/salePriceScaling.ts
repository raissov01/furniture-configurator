/**
 * Қолмен қойылған сату бағасын ЛДСП ауданына ПРОПОРЦИОНАЛ жаңарту (опция).
 *
 * НЕГЕ КЕРЕК. Менеджер клиентпен «осы шкаф — 450 000 ₸» деп келіседі де,
 * сату бағасын қолмен қояды. Кейін клиент «10 см кеңірек» десе, қолмен
 * қойылған баға ТҰРАҚТЫ қалады — цех зиян шегеді. Опция қосулы болса, баға
 * ЛДСП ауданының өзгерісіне пропорционал жүреді: аудан 10% өссе, баға да 10%.
 *
 * Базасы — баға САҚТАЛҒАН сәттегі аудан (`PriceOverrides.salePriceScaling`).
 * Ауданға қай материалдар кіретіні де сол сәтте жазылады: кейін жаңа материал
 * қосылса (мыс. столешница), ол базамен салыстырылмайды.
 *
 * ДӨҢГЕЛЕКТЕУ ЕРЕЖЕСІ (`SALE_PRICE_SCALING_ROUNDING`):
 *   - аудан өзгермесе — баға ДӘЛ сол тиын (ешқандай дөңгелектеу жоқ);
 *   - өзгерсе — `salePrice × қазіргі / база` ең жақын БҮТІН ТЕҢГЕГЕ
 *     (100 тиын), дәл жартысы ЖОҒАРЫ. Есеп BigInt-пен, float жоқ.
 */

import { ConfigValidationError } from './errors'
import { polygonArea } from './polygon'
import type { Panel, SalePriceScaling } from './types'
import type { ShopProfile } from './shop'

export const SALE_PRICE_SCALING_ROUNDING = 'nearestTengeHalfUp' as const

const FIELD = 'priceOverrides.salePriceScaling'

/** Детальдің готовый ауданы, мм² (контурлы детальде — көпбұрыш ауданы). */
function panelAreaMm2(panel: Panel): number {
  const one = panel.contour ? polygonArea(panel.contour.points) : panel.finishedLength * panel.finishedWidth
  return one * panel.qty
}

/** Берілген материалдардағы детальдердің жалпы ауданы, бүтін мм². */
export function scalingAreaMm2(panels: Panel[], materialIds: readonly string[]): number {
  const ids = new Set(materialIds)
  const total = panels.reduce((sum, p) => sum + (ids.has(p.materialId) ? panelAreaMm2(p) : 0), 0)
  return Math.round(total)
}

/**
 * Ауданға кіретін материалдар: ПАРАҚ материалдары (тақта/постформинг емес),
 * тек артқы қабырғаға кететіндері (ХДФ) кірмейді — ол ЛДСП емес әрі шкафтың
 * бағасын анықтамайды.
 */
export function defaultScalingMaterialIds(panels: Panel[], shop: ShopProfile): string[] {
  const slab = new Set(shop.materials.filter((m) => m.slab).map((m) => m.id))
  const ids = new Set<string>()
  for (const p of panels) {
    if (p.role === 'back' || slab.has(p.materialId)) continue
    ids.add(p.materialId)
  }
  return [...ids].sort()
}

/** Сату бағасы сақталған сәтте шақырылады: базаны жазып алады. */
export function captureSalePriceScaling(
  panels: Panel[],
  shop: ShopProfile,
  materialIds: string[] = defaultScalingMaterialIds(panels, shop),
): SalePriceScaling {
  if (materialIds.length === 0) {
    throw new ConfigValidationError(`${FIELD}.materialIds`, 'ЛДСП деталі жоқ', 'кемінде бір парақ материалы')
  }
  const baseAreaMm2 = scalingAreaMm2(panels, materialIds)
  if (baseAreaMm2 <= 0) {
    throw new ConfigValidationError(`${FIELD}.baseAreaMm2`, `${baseAreaMm2} — аудан нөл`, '> 0 мм²')
  }
  return { baseAreaMm2, materialIds: [...materialIds] }
}

/** Пропорционал баға, тиын. Ереже — файлдың басындағы түсінікте. */
export function scaleSalePrice(salePrice: number, baseAreaMm2: number, currentAreaMm2: number): number {
  if (!Number.isSafeInteger(salePrice) || salePrice < 0) {
    throw new ConfigValidationError('priceOverrides.salePrice', `${salePrice} — бүтін тиын емес`, '≥ 0, бүтін тиын')
  }
  if (!Number.isSafeInteger(baseAreaMm2) || baseAreaMm2 <= 0) {
    throw new ConfigValidationError(`${FIELD}.baseAreaMm2`, `${baseAreaMm2}`, '> 0, бүтін мм²')
  }
  if (!Number.isSafeInteger(currentAreaMm2) || currentAreaMm2 < 0) {
    throw new ConfigValidationError(`${FIELD}.currentAreaMm2`, `${currentAreaMm2}`, '≥ 0, бүтін мм²')
  }
  if (currentAreaMm2 === baseAreaMm2) return salePrice
  const numerator = BigInt(salePrice) * BigInt(currentAreaMm2)
  const denominator = BigInt(baseAreaMm2) * 100n
  const tenge = (2n * numerator + denominator) / (2n * denominator)
  return Number(tenge * 100n)
}
