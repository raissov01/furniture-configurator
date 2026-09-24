import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** AR жүктеу және жүктеп алу route-тары қолданатын уақытша GLB қоймасы. */
export function arDir(): string {
  const base = process.env['DATA_DIR'] ?? join(process.cwd(), '.data')
  const dir = join(base, 'ar')
  mkdirSync(dir, { recursive: true })
  return dir
}
