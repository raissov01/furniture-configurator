import { formatTengeExact } from '../../src/core/pricing'

export type ApprovalMessage = {
  phone: string
  projectName: string
  priceMinor: number
  shareCode: string
  confirmationCode: string
  link: string
  language?: 'kk' | 'ru'
}

/** wa.me text includes the offer, viewer URL and both distinct six-digit codes. */
export function approvalWhatsAppUrl(input: ApprovalMessage): string {
  const phone = input.phone.replace(/[\s()+-]/g, '')
  if (!/^\d{10,15}$/.test(phone)) throw new Error('phone: ел коды бар 10–15 цифр қажет')
  if (!input.projectName.trim()) throw new Error('projectName: атау қажет')
  if (!Number.isSafeInteger(input.priceMinor) || input.priceMinor < 0) throw new Error('priceMinor: теріс емес бүтін тиын қажет')
  if (!/^\d{6}$/.test(input.shareCode)) throw new Error('shareCode: 6 цифр қажет')
  if (!/^\d{6}$/.test(input.confirmationCode)) throw new Error('confirmationCode: 6 цифр қажет')
  let link: URL
  try { link = new URL(input.link) } catch { throw new Error('link: дұрыс HTTPS сілтемесі қажет') }
  if (!(link.protocol === 'https:' || (link.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(link.hostname))) ||
      link.searchParams.get('c') !== input.shareCode) {
    throw new Error('link: жоба коды бар HTTPS сілтемесі қажет')
  }
  const price = formatTengeExact(input.priceMinor)
  const lines = input.language === 'kk'
    ? [`КП: ${input.projectName}`, `Бағасы: ${price}`, `Жоба: ${link.toString()}`,
      `Жоба коды: ${input.shareCode}`, `Растау коды: ${input.confirmationCode}`]
    : [`КП: ${input.projectName}`, `Цена: ${price}`, `Проект: ${link.toString()}`,
      `Код проекта: ${input.shareCode}`, `Код подтверждения: ${input.confirmationCode}`]
  const url = new URL(`https://wa.me/${phone}`)
  url.searchParams.set('text', lines.join('\n'))
  return url.toString()
}
