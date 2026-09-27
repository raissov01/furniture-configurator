'use client'

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { createKaspiManualPlan, formatTengeMinor } from '@/src/core/kaspiManual'
import { MoneyInput } from './MoneyInput'

/** Merchant prepares both invoices in Kaspi Pay; this panel never marks a payment as paid. */
export function KaspiManualPanel({ totalMinor, defaultReference }: { totalMinor: number; defaultReference: string }) {
  const [advanceMinor, setAdvanceMinor] = useState<number | undefined>()
  const [advanceValid, setAdvanceValid] = useState(true)
  const [reference, setReference] = useState(defaultReference)
  const [merchantUrl, setMerchantUrl] = useState('')
  const [requested, setRequested] = useState(false)

  let plan: ReturnType<typeof createKaspiManualPlan> | null = null
  let error: string | null = null
  if (requested && advanceValid) {
    try {
      plan = createKaspiManualPlan({
        totalMinor, advanceMinor: advanceMinor ?? 0, reference,
        ...(merchantUrl.trim() ? { merchantPaymentUrl: merchantUrl.trim() } : {}),
      })
    } catch (cause) {
      if (!(cause instanceof RangeError)) throw cause
      error = cause.message.startsWith('merchantPaymentUrl:')
        ? tr('Введите HTTPS-ссылку kaspi.kz из Kaspi Pay')
        : cause.message.startsWith('advanceMinor:')
          ? tr('Аванс должен быть больше нуля и меньше общей суммы')
          : tr('Введите номер КП или заказа')
    }
  }

  return <section className="space-y-2 border border-neutral-300 bg-white p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900" aria-label={tr('Kaspi Pay · счёт вручную')}>
    <h3 className="text-sm font-semibold">{tr('Kaspi Pay · счёт вручную')}</h3>
    <p>{tr('Продавец выставляет счёт в Kaspi Pay POS. Приложение не подтверждает оплату автоматически.')}</p>
    <p>{tr('К оплате')}: <strong>{formatTengeMinor(totalMinor)}</strong></p>
    <label className="block space-y-1">
      <span>{tr('Аванс, ₸')}</span>
      <MoneyInput value={advanceMinor} label={tr('Аванс, ₸')} onChange={setAdvanceMinor} onValidityChange={setAdvanceValid} />
    </label>
    <label className="block space-y-1">
      <span>{tr('Номер КП или заказа')}</span>
      <input className="w-full border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" value={reference}
        maxLength={100} onChange={(event) => setReference(event.target.value)} />
    </label>
    <label className="block space-y-1">
      <span>{tr('Ссылка Kaspi от продавца (необязательно)')}</span>
      <input className="w-full border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" type="url" inputMode="url"
        value={merchantUrl} onChange={(event) => setMerchantUrl(event.target.value)} />
    </label>
    <button type="button" className="border border-neutral-400 bg-white px-3 py-1.5 dark:bg-neutral-900" onClick={() => setRequested(true)}>
      {tr('Показать суммы счетов')}
    </button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {plan && <div className="space-y-1 border-t border-neutral-200 pt-2 dark:border-neutral-700">
      <p>{tr('Аванс')}: <strong>{formatTengeMinor(plan.advance.amountMinor)}</strong></p>
      <p>{tr('Остаток')}: <strong>{formatTengeMinor(plan.final.amountMinor)}</strong></p>
      {plan.advance.merchantPaymentUrl && <a className="underline" href={plan.advance.merchantPaymentUrl} target="_blank" rel="noopener noreferrer">
        {tr('Открыть ссылку продавца')}
      </a>}
      <p>{tr('По ссылке клиент вводит сумму сам; продавец сверяет оплату в Kaspi Pay и выдаёт чек.')}</p>
      <p className="font-medium">{tr('Статус: ожидается счёт продавца')}</p>
    </div>}
  </section>
}
