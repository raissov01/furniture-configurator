import { SEED_CATALOG } from '@/src/core/index'
import type { CabinetConfig, Catalog } from '@/src/core/index'

export const catalog: Catalog = SEED_CATALOG

const carcass = catalog.materials.find((m) => m.id === 'ldsp16-h1145')!

/** CLAUDE.md §8.7 эталон шкафы — конфигуратор осыдан басталады. */
export const defaultCabinet: CabinetConfig = {
  id: 'cabinet-1',
  name: 'Шкаф-пенал',
  construction: 'sidesOverlay',
  height: 2000,
  width: 600,
  depth: 450,
  carcassMaterialId: carcass.id,
  frontMaterialId: carcass.id,
  backMaterialId: 'hdf3-white',
  back: { mode: 'overlay' },
  sections: [
    {
      id: 's1',
      widthMode: 'flex',
      contents: [{ kind: 'shelves', count: 4, shelfKind: 'adjustable' }],
      fronts: { count: 2, mount: 'overlay' },
    },
  ],
  edging: carcass.defaultEdging!,
}

export const carcassMaterials = catalog.materials.filter((m) => m.thickness >= 10)
export const backMaterials = catalog.materials.filter((m) => m.thickness < 10)
