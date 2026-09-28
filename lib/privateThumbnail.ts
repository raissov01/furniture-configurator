/** Private library thumbnails must be embedded in the owner's LibraryItem. */
export function privateThumbnailUrl(value: string | undefined): string | null {
  if (!value || value.length > 65_536) return null
  return /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null
}

export async function privateThumbnailFromFile(file: File): Promise<string> {
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) throw new Error('PNG, WebP немесе JPEG таңдаңыз')
  if (file.size > 48_000) throw new Error('Нобай 48 КБ-тан аспауы керек')
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const result = `data:${file.type};base64,${btoa(binary)}`
  if (!privateThumbnailUrl(result)) throw new Error('Нобай дерегі жарамсыз')
  return result
}
