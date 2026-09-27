import { SEED_TEMPLATES, STANDARD_NOMENCLATURE_TEMPLATES, templateToCabinet } from '@/src/core/templates'
import type { CabinetConfig, Catalog } from '@/src/core/types'

/** Exact config match keeps the gallery marker honest after reload or editing. */
export function matchTemplateId(cabinets: CabinetConfig[], activeId: string, catalog: Catalog): string {
  if (cabinets.length !== 1) return ''
  const active = cabinets.find((cabinet) => cabinet.id === activeId)
  if (!active) return ''
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object') {
      const source = value as Record<string, unknown>
      return Object.fromEntries(Object.keys(source).sort().map((key) => [key, canonical(source[key])]))
    }
    return value
  }
  const signature = (cabinet: CabinetConfig) => JSON.stringify(canonical({ ...cabinet, id: '' }))
  for (const template of [...SEED_TEMPLATES, ...STANDARD_NOMENCLATURE_TEMPLATES]) {
    const material = catalog.materials.find((entry) => entry.id === template.carcassMaterialId)
    if (!material?.defaultEdging) continue
    if (signature(active) === signature(templateToCabinet(template, catalog))) return template.id
  }
  return ''
}
