/**
 * Смета жолының өлшем бірлігі — экранда аударылған түрде.
 *
 * Ядро (`pricing.ts`) бірлікті қысқа орысша белгімен береді ('лист', 'отв',
 * 'дет'…) — ол PDF пен CSV-ге сол күйі түседі. Экранда бірлік тілге қарай
 * аударылады, сонда «3 парақ × 5 000 ₸» не «142 тесік × 35 ₸» көрінеді.
 */
import { t, tf } from '@/lib/i18n'
import { formatTengeExact } from '@/src/core/index'
import type { PriceLine } from '@/src/core/index'

const UNIT_KEYS: Record<PriceLine['unit'], string> = {
  'лист': 'лист.',
  'отв': 'отв.',
  'дет': 'дет.',
  'шт': 'шт.',
  'м': 'м',
  'м²': 'м²',
}

export function unitLabel(unit: PriceLine['unit']): string {
  return t(UNIT_KEYS[unit])
}

/** «Присадка: 3 парақ × 5 000 ₸» — жолдың саны, бірлігі және бағасы. */
export function serviceLineText(line: PriceLine): string {
  return tf('{name}: {qty} {unit} × {price}', {
    name: t(line.name), qty: line.qty, unit: unitLabel(line.unit), price: formatTengeExact(line.unitPrice),
  })
}
