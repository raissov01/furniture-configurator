export function validateBin(value: string): string | null {
  return value === '' || /^\d{12}$/.test(value) ? null : 'БИН: требуется 12 цифр'
}

export function validateShopLogo(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/png', 'image/jpeg'].includes(file.type)) return 'Логотип: PNG или JPEG'
  if (file.size > 750_000) return 'Логотип: не больше 750 КБ'
  return null
}
