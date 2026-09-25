/** Kaspi Pay шоты сатушының POS қолданбасында қолмен жасалады; мұнда API шақыру жоқ. */
export type KaspiManualRequest = {
  stage: 'advance' | 'final'
  amountMinor: number
  method: 'manualKaspiInvoice'
  status: 'awaitingMerchantInvoice'
  instructions: string
  merchantPaymentUrl?: string
}

export type KaspiManualPlan = {
  totalMinor: number
  advance: KaspiManualRequest
  final: KaspiManualRequest
}

function minorAmount(value: number, name: string, allowZero = true): void {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new RangeError(`${name}: тиынмен ${allowZero ? '0 не одан үлкен' : '0-ден үлкен'} қауіпсіз бүтін сан болуы керек`)
  }
}

/** Тиынды көрсеткенде дөңгелектеу болмайды. */
export function formatTengeMinor(amountMinor: number): string {
  minorAmount(amountMinor, 'amountMinor')
  const whole = Math.floor(amountMinor / 100)
  const fraction = String(amountMinor % 100).padStart(2, '0')
  return `${whole},${fraction} ₸`
}

function kaspiMerchantUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new RangeError('merchantPaymentUrl: дұрыс HTTPS сілтеме керек')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !(url.hostname === 'kaspi.kz' || url.hostname.endsWith('.kaspi.kz'))) {
    throw new RangeError('merchantPaymentUrl: Kaspi Pay қолданбасынан көшірілген kaspi.kz HTTPS сілтемесі керек')
  }
  return url.href
}

export function createKaspiManualPlan(input: {
  totalMinor: number
  advanceMinor: number
  reference: string
  merchantPaymentUrl?: string
}): KaspiManualPlan {
  minorAmount(input.totalMinor, 'totalMinor', false)
  minorAmount(input.advanceMinor, 'advanceMinor', false)
  if (input.advanceMinor >= input.totalMinor) {
    throw new RangeError('advanceMinor: аванс жалпы сомадан кіші болуы керек')
  }
  const reference = input.reference.trim()
  if (!reference || reference.length > 100 || /[\x00-\x1f\x7f]/.test(reference)) {
    throw new RangeError('reference: 1–100 таңбалық КП/тапсырыс нөмірі керек')
  }
  const merchantPaymentUrl = kaspiMerchantUrl(input.merchantPaymentUrl)
  const finalMinor = input.totalMinor - input.advanceMinor

  function request(stage: 'advance' | 'final', amountMinor: number): KaspiManualRequest {
    const label = stage === 'advance' ? 'аванс' : 'соңғы төлем'
    const instructions = `${reference}: ${label} ${formatTengeMinor(amountMinor)}. ` +
      'Сатушы Kaspi Pay POS ішінен клиент нөміріне дәл осы сомамен «Счет на оплату» жібереді; ' +
      'төлемді Kaspi Pay тарихынан қолмен растап, Kaspi Касса чегін береді.' +
      (merchantPaymentUrl ? ' Қосымша сілтемеде клиент соманы өзі енгізеді; сатушы соманы қолмен тексереді.' : '')
    return { stage, amountMinor, method: 'manualKaspiInvoice', status: 'awaitingMerchantInvoice', instructions, ...(merchantPaymentUrl ? { merchantPaymentUrl } : {}) }
  }

  return {
    totalMinor: input.totalMinor,
    advance: request('advance', input.advanceMinor),
    final: request('final', finalMinor),
  }
}
