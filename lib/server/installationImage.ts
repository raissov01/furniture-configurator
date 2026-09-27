import sharp from 'sharp'

type EvidenceKind = 'photo' | 'signature'

/** Decode evidence before a task revision is written. A data URL prefix alone is not proof of an image. */
export async function validateInstallationImage(dataUrl: string, kind: EvidenceKind): Promise<void> {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!match || (kind === 'signature' && match[1] !== 'png')) throw new Error('Монтаж фото/қол суретінің пішімі жарамсыз')
  const bytes = Buffer.from(match[2]!, 'base64')
  if (bytes.length < 32 || bytes.length > 2_100_000) throw new Error('Монтаж фото/қол суретінің көлемі жарамсыз')
  try {
    const source = sharp(bytes, { limitInputPixels: 16_777_216, failOn: 'warning' })
    const metadata = await source.metadata()
    if (metadata.format !== match[1] || !metadata.width || !metadata.height ||
      metadata.width > 4096 || metadata.height > 4096) throw new Error('Өлшем немесе пішім жарамсыз')
    const { data, info } = await source.flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true })
    if (kind === 'signature') {
      let ink = 0
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i]! < 248 || data[i + 1]! < 248 || data[i + 2]! < 248) ink++
        if (ink >= 4) return
      }
      throw new Error('Клиенттің қолтаңбасында нақты сызық жоқ')
    }
  } catch (cause) {
    if (cause instanceof Error && /қолтаңбасында/.test(cause.message)) throw cause
    throw new Error('Монтаж фото/қол суреті бүлінген')
  }
}
