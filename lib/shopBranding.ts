export function validateBin(value: string): string | null {
  return value === '' || /^\d{12}$/.test(value) ? null : 'БИН: 12 цифр қажет'
}

export function validateShopLogo(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/png', 'image/jpeg'].includes(file.type)) return 'Логотип: PNG немесе JPEG қажет'
  if (file.size > 750_000) return 'Логотип: 750 КБ-тан аспауы керек'
  return null
}
