import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import manifest from '../public/library/basis/manifest.json'
import catalogPreviews from '../public/library/basis/catalog.json'
import { BASIS_MODULES } from '../src/core/data/basisModules'
import { PRO100_CABINET_ITEMS } from '../src/core/data/pro100Catalog'
import { basisModulePreview, pro100BasisPreview } from '../lib/basisPreview'
import type { BasisModule } from '../src/core/data/basisModules'
import type { Pro100LibraryItem } from '../src/core/data/pro100Catalog'

const module: BasisModule = { raw: 'ШВ360х300х600-2Д', system: 'standard', kind: 'wall', height: 360,
  depth: 300, width: 600, doors: 2, drawers: 0, hand: null, count: 1, tokens: ['2Д'] }
const item = { group: 'cabinet', name: 'В - 600 2Дв', path: ['Верхние', '360'],
  parsed: { position: 'upper', widthMm: 600, doorCount: 2 }, id: 'one' } as Pro100LibraryItem
const previews = { 'standard/ШВ360х300х600-2Д': '/library/basis/test.webp' }

describe('каталогқа Базис нобайын байлау', () => {
  it('жүйе мен атау дәл келсе сурет қайтарады', () => {
    expect(basisModulePreview(module, previews)).toBe('/library/basis/test.webp')
  })
  it('PRO100 атауының түрі, H, W және есік саны сәйкес болса аналогты табады', () => {
    expect(pro100BasisPreview(item, [module], previews)).toBe('/library/basis/test.webp')
  })
  it('нақты манифест барлық Базис жазбасын қамтиды және файлдар бар', () => {
    // One listing of the flat /library/basis folder instead of ~14k existsSync
    // calls (each ~0.6 ms on Windows NTFS, which alone exceeded the 5 s timeout).
    const published = new Set(readdirSync(path.join(process.cwd(), 'public', 'library', 'basis')))
    const exists = (asset: string) => published.has(asset.slice('/library/basis/'.length))
    expect(Object.keys(manifest.modules)).toHaveLength(6948)
    expect(Object.keys(manifest.paths)).toHaveLength(6956)
    expect(catalogPreviews).toEqual(manifest.modules)
    for (const asset of Object.values(manifest.paths)) {
      expect(asset).toMatch(/^\/library\/basis\/[a-f0-9]{20}\.webp$/)
      expect(exists(asset)).toBe(true)
    }
    for (const module of BASIS_MODULES) {
      const asset = basisModulePreview(module, manifest.modules)
      expect(asset).toMatch(/^\/library\/basis\/[a-f0-9]{20}\.webp$/)
      expect(exists(asset!)).toBe(true)
    }
  })
  it('PRO100 байланысының санын бақылайды', () => {
    const matched = PRO100_CABINET_ITEMS.filter((entry) => pro100BasisPreview(entry, BASIS_MODULES, manifest.modules))
    expect(matched).toHaveLength(43)
  })
  it('сәйкес емес биіктікке не есік санына бөтен модульді тақпайды', () => {
    expect(pro100BasisPreview({ ...item, path: ['Верхние', '720'] }, [module], previews)).toBeNull()
    expect(pro100BasisPreview({ ...item, parsed: { ...item.parsed, doorCount: 1 } }, [module], previews)).toBeNull()
  })
})
