import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** AR сілтемесі мен уақытша GLB файлының өмірі: бір сағат. */
export const AR_TTL_MS = 60 * 60 * 1000

/** AR жүктеу және жүктеп алу route-тары қолданатын уақытша GLB қоймасы. */
export function arDir(): string {
  const base = process.env['DATA_DIR'] ?? join(process.cwd(), '.data')
  const dir = join(base, 'ar')
  mkdirSync(dir, { recursive: true })
  return dir
}
