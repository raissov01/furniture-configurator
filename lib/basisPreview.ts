import type { BasisModule } from '@/src/core/data/basisModules'
import type { Pro100LibraryItem } from '@/src/core/data/pro100Catalog'

export type BasisPreviewMap = Readonly<Record<string, string>>

export function basisModulePreview(module: BasisModule, previews: BasisPreviewMap): string | null {
  return previews[`${module.system}/${module.raw.normalize('NFC')}`] ?? null
}

/** Match only fields present in the PRO100 name/path; unknown depth remains unknown. */
export function pro100BasisPreview(item: Pro100LibraryItem, modules: readonly BasisModule[], previews: BasisPreviewMap): string | null {
  if (item.group !== 'cabinet' || item.parsed.hasSink) return null
  const kind = item.parsed.position === 'upper' ? 'wall'
    : item.parsed.position === 'lower' ? 'base'
      : item.parsed.position === 'combined' ? 'tall' : null
  const height = item.path.map((part) => /^\d{3,4}$/.test(part.trim()) ? Number(part.trim()) : null)
    .find((value) => value !== null)
  const width = item.parsed.widthMm
  const doors = item.parsed.doorCount ?? 0
  const drawers = item.parsed.drawerCount ?? 0
  if (!kind || !height || !width || (doors === 0 && drawers === 0)) return null
  const system = item.path.some((part) => /gola/i.test(part)) ? 'gola' : 'standard'
  const candidates = modules.filter((module) => module.system === system && module.kind === kind
    && module.height === height && module.width === width && module.doors === doors && module.drawers === drawers
    && basisModulePreview(module, previews) !== null)
  if (candidates.length === 0) return null
  // The PRO100 label does not contain depth. Multiple different depths are ambiguous.
  if (new Set(candidates.map((module) => module.depth)).size > 1) return null
  return basisModulePreview(candidates[0]!, previews)
}
