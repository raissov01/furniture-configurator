import { SEED_CATALOG, findTemplate, templateToCabinet } from '@/src/core/index'
import type { CabinetConfig, Catalog } from '@/src/core/index'

export const catalog: Catalog = SEED_CATALOG

/** Конфигуратор ашылғанда тұратын шаблон. */
export const defaultTemplateId = 'wardrobe-penal-600'

/**
 * CLAUDE.md §8.7 эталон шкафы. Ол бөлек жазылмайды — сол шаблонның өзі,
 * әйтпесе екеуі бір-бірінен алшақтап кетеді. Аты мен id-і ғана тарихи
 * қалпында қалды.
 */
export const defaultCabinet: CabinetConfig = {
  ...templateToCabinet(findTemplate(defaultTemplateId)!, catalog),
  id: 'cabinet-1',
  name: 'Шкаф-пенал',
}

export const carcassMaterials = catalog.materials.filter((m) => m.thickness >= 10)
export const backMaterials = catalog.materials.filter((m) => m.thickness < 10)
