import { ConfigValidationError, generateCabinet, nextSectionId } from '../src/core/index'
import type { CabinetConfig, Catalog, Section, SettingsOverride } from '../src/core/index'

export type SectionAddResult = { ok: true; sections: Section[] } | { ok: false; message: string }

/** Preview the same production panels before committing a section edit. */
export function planSectionAddition(cabinet: CabinetConfig, catalog: Catalog, settings?: SettingsOverride): SectionAddResult {
  const sections: Section[] = [
    ...cabinet.sections,
    { id: nextSectionId(cabinet.sections), widthMode: 'flex',
      contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
      fronts: { count: 1, mount: 'overlay' } },
  ]
  try {
    generateCabinet({ ...cabinet, sections }, catalog, settings)
    return { ok: true, sections }
  } catch (cause) {
    if (!(cause instanceof ConfigValidationError)) throw cause
    return { ok: false, message: cause.message }
  }
}
