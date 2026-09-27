/** Сурет түрін MIME мен нақты файл қолтаңбасымен бірге тексеру. */
export const MAX_CATALOG_IMAGE_BYTES = 1_000_000

export function validateCatalogImage(bytes: Uint8Array, mime: string): 'png' | 'jpg' | 'webp' {
  if (bytes.length === 0 || bytes.length > MAX_CATALOG_IMAGE_BYTES) throw new Error('image: 1..1000000 байт')
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  if (mime === 'image/png' && starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'png'
  if (mime === 'image/jpeg' && starts(255, 216, 255)) return 'jpg'
  if (mime === 'image/webp' && starts(82, 73, 70, 70) &&
    [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)) return 'webp'
  throw new Error('image: PNG, JPEG немесе WebP қолтаңбасы керек')
}
