import type { Material } from '@/src/core/types'
import type { OwnMaterialMeta } from '@/src/core/data/catalog/schema'

export type OwnMaterialFilters = { manufacturer: string; collection: string; decorCode: string }

const normalizedCode = (value: string) => value.replace(/[\s_.-]/gu, '').toLocaleLowerCase()

export function ownMaterialOptions(materials: Material[], meta: Record<string, OwnMaterialMeta>) {
  const entries = materials.map((material) => meta[material.id]).filter((entry): entry is OwnMaterialMeta => Boolean(entry))
  return {
    manufacturers: [...new Set(entries.map((entry) => entry.manufacturer))].sort((a, b) => a.localeCompare(b)),
    collections: [...new Set(entries.map((entry) => entry.collection).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)),
  }
}

export function filterOwnMaterials(materials: Material[], meta: Record<string, OwnMaterialMeta>, filters: OwnMaterialFilters): Material[] {
  const code = normalizedCode(filters.decorCode)
  return materials.filter((material) => {
    const entry = meta[material.id]
    return Boolean(entry &&
      (!filters.manufacturer || entry.manufacturer === filters.manufacturer) &&
      (!filters.collection || entry.collection === filters.collection) &&
      (!code || normalizedCode(entry.decorCode).includes(code)))
  })
}
