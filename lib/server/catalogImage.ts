/** Сурет түрін MIME мен нақты файл қолтаңбасымен бірге тексеру. */
export const MAX_CATALOG_IMAGE_BYTES = 1_000_000

export function validateCatalogImage(bytes: Uint8Array, mime: string): 'png' | 'jpg' | 'webp' {
  if (bytes.length === 0 || bytes.length > MAX_CATALOG_IMAGE_BYTES) throw new Error('image: 1..1000000 байт')
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  if (mime === 'image/png' && bytes.length >= 45 && starts(137, 80, 78, 71, 13, 10, 26, 10)
    && [0, 0, 0, 13, 73, 72, 68, 82].every((value, index) => bytes[index + 8] === value)
    && [0, 0, 0, 0, 73, 69, 78, 68].every((value, index) => bytes[bytes.length - 12 + index] === value)) return 'png'
  if (mime === 'image/jpeg' && bytes.length >= 16 && starts(255, 216, 255)
    && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) return 'jpg'
  if (mime === 'image/webp' && starts(82, 73, 70, 70) &&
    bytes.length >= 20 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) === bytes.length - 8 &&
    [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)) return 'webp'
  throw new Error('image: PNG, JPEG немесе WebP қолтаңбасы керек')
}
