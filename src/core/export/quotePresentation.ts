/** Клиенттік КП-ға ғана тиесілі жолдар. Цехтың ішкі есебі мұнда кірмейді. */
export function quoteSummaryRows(totals: { grossTotal: number; discount: number; total: number }):
  { title: string; amount: number; prominent: boolean }[] {
  if (totals.discount === 0) return [{ title: 'К оплате', amount: totals.total, prominent: true }]
  return [
    { title: 'Итого', amount: totals.grossTotal, prominent: false },
    { title: 'Скидка', amount: -totals.discount, prominent: false },
    { title: 'К оплате', amount: totals.total, prominent: true },
  ]
}

export function shopContactRows(shop: {
  name: string; bin?: string | undefined; phone: string; address?: string | undefined; city: string
}): string[] {
  const rows = [shop.name.trim()]
  if (shop.bin?.trim()) rows.push(`БИН: ${shop.bin.trim()}`)
  if (shop.phone.trim()) rows.push(`Телефон: ${shop.phone.trim()}`)
  const location = shop.address?.trim() || shop.city.trim()
  if (location) rows.push(`Адрес: ${location}`)
  return rows.filter(Boolean)
}

/** Ақ қағаздағы ұсақ бренд мәтіні WCAG AA (4.5:1) контрастын сақтайды. */
export function readableBrandText(hex: string): string {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
  return 1.05 / (luminance + 0.05) >= 4.5 ? hex : '#1F2A37'
}
