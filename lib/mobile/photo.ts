/** Resize camera images before storing or uploading them. The server accepts at most 8 MB. */
export async function prepareMeasurementPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Фотосурет файлын таңдаңыз')
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Фотоны өңдеу қолжетімсіз')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('Фото сығылмады')), 'image/jpeg', 0.8))
    if (blob.size > 8_000_000) throw new Error('Фото 8 МБ-тан асады; басқа фото таңдаңыз')
    return blob
  } finally {
    image.close()
  }
}
