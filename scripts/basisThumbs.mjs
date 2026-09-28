import path from 'node:path'
import { createHash } from 'node:crypto'

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** Only parse standard PNG chunk framing; the surrounding B3D/FR3D data stays opaque. */
export function extractEmbeddedPng(bytes) {
  let start = bytes.indexOf(SIGNATURE)
  while (start >= 0) {
    let offset = start + SIGNATURE.length
    let seenImage = false
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset)
      const end = offset + 12 + length
      if (length > 32 * 1024 * 1024 || end > bytes.length) break
      const type = bytes.toString('ascii', offset + 4, offset + 8)
      if (type === 'IDAT') seenImage = true
      offset = end
      if (type === 'IEND' && length === 0 && seenImage) return bytes.subarray(start, end)
    }
    start = bytes.indexOf(SIGNATURE, start + SIGNATURE.length)
  }
  return null
}

export function moduleKey(system, name) {
  return `${system}/${name.trim().normalize('NFC').replace(/\.b3d$/iu, '')}`
}

export function previewAssetName(png) {
  return `${createHash('sha256').update(png).digest('hex').slice(0, 20)}.webp`
}

/** Hardware images may only be written to an explicitly chosen private directory. */
export function privateOutputAllowed(directory, publicDirectory) {
  const relative = path.relative(path.resolve(publicDirectory), path.resolve(directory))
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
}
