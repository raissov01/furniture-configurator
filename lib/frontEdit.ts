import { ConfigValidationError, generateCabinet } from '../src/core/index'
import type { CabinetConfig, Catalog, SectionFronts, SettingsOverride } from '../src/core/index'

export type FrontEditResult =
  | { ok: true; fronts: SectionFronts | null }
  | { ok: false; field: string; message: string; allowed?: string | undefined }

/** Run the same core validation before a front control changes the saved project. */
export function previewFrontEdit(
  cabinet: CabinetConfig,
  sectionIndex: number,
  patch: Partial<SectionFronts>,
  catalog: Catalog,
  settings?: SettingsOverride,
): FrontEditResult {
  const section = cabinet.sections[sectionIndex]
  if (!section) return { ok: false, field: `sections[${sectionIndex}]`, message: 'секция табылмады' }
  const previous = section.fronts ?? { count: 1, mount: 'overlay' as const }
  const fronts: SectionFronts = {
    ...previous,
    ...patch,
    gaps: patch.gaps ? { ...previous.gaps, ...patch.gaps } : previous.gaps,
  }
  if (patch.mount !== undefined && patch.mount !== previous.mount && patch.hingeSystemId === undefined) {
    // A deliberately selected hinge belongs to the old mounting style.
    // Let the core choose the first compatible system for the new style.
    fronts.hingeSystemId = undefined
  }
  const nextFronts = fronts.count > 0 ? fronts : null
  const nextCabinet = {
    ...cabinet,
    sections: cabinet.sections.map((item, index) => index === sectionIndex ? { ...item, fronts: nextFronts } : item),
  }
  try {
    generateCabinet(nextCabinet, catalog, settings)
    return { ok: true, fronts: nextFronts }
  } catch (cause) {
    if (!(cause instanceof ConfigValidationError)) throw cause
    return { ok: false, field: cause.field, message: cause.message, allowed: cause.allowed }
  }
}
