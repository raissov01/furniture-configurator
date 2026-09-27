/**
 * «Свойства» диалогының таза логикасы (аудит 09-26, P0-3).
 *
 * - `propertiesDirty` — «Применить» тек нақты өзгеріс болғанда белсенді.
 * - `propertiesInvalid` — жарамсыз мәннің себебі адам оқитын түрде.
 * - `propertiesKeyAction` — Enter = OK, Esc = Отмена (PRO100 сияқты).
 */

import type { PropertiesSession } from '@/lib/propertiesSession'

/** Тарих жазбалары (past/future/lastEdit*) өзгеріс саналмайды. */
const EDIT_KEYS = [
  'root', 'layers', 'room', 'cabinets', 'placements', 'activeId', 'showDimensions',
  'projectSettings', 'projectMaterials', 'projectEdgeBands', 'catalog', 'projectInfo', 'priceOverrides',
] as const satisfies readonly (keyof PropertiesSession)[]

/** Store иммутабельді: өзгерген бөлік — жаңа сілтеме. */
export function propertiesDirty(baseline: PropertiesSession, current: PropertiesSession): boolean {
  return EDIT_KEYS.some((key) => !Object.is(baseline[key], current[key]))
}

const FIELD_LABELS: Record<string, string> = {
  'cabinet.height': 'Высота (H)',
  'cabinet.width': 'Ширина (W)',
  'cabinet.depth': 'Глубина (D)',
}

export type PropertiesInvalid = { field: string; label: string; detail: string; allowed: string | undefined }

export function propertiesInvalid(error: { field: string; message: string; allowed?: string | undefined } | null): PropertiesInvalid | null {
  if (!error) return null
  let detail = error.message
  if (detail.startsWith(`${error.field}: `)) detail = detail.slice(error.field.length + 2)
  if (error.allowed) {
    const suffix = ` (рұқсат етілген: ${error.allowed})`
    if (detail.endsWith(suffix)) detail = detail.slice(0, -suffix.length)
  }
  return { field: error.field, label: FIELD_LABELS[error.field] ?? error.field, detail, allowed: error.allowed }
}

export type PropertiesKeyEvent = {
  key: string
  /** Фокустағы элемент тегі (кіші әріппен). */
  target: string
  exactInput?: boolean
  isComposing?: boolean
  shiftKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

/** Enter батырмада/тізімде/мәтін аймағында — браузердің өз әрекеті. */
const NATIVE_ENTER = new Set(['button', 'select', 'textarea', 'a'])

export function propertiesKeyAction(event: PropertiesKeyEvent): 'ok' | 'cancel' | null {
  if (event.isComposing) return null
  if (event.key === 'Escape') return 'cancel'
  if (event.key !== 'Enter') return null
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return null
  if (event.exactInput) return null
  return NATIVE_ENTER.has(event.target) ? null : 'ok'
}

/** A file must describe the committed project, including its valid panel model. */
export function propertiesProductionReady(dirty: boolean, invalid: boolean, draftInvalid: boolean): boolean {
  return !dirty && !invalid && !draftInvalid
}

export function propertiesChildModalActive(quoteOpen: boolean, drillOpen: boolean, galleryOpen = false, shopOpen = false): boolean {
  return quoteOpen || drillOpen || galleryOpen || shopOpen
}

/** Child dialogs can show live data, but must not download files while Properties can still Cancel. */
export function childExportAllowed(propertiesOpen: boolean): boolean {
  return !propertiesOpen
}

/** Structure keeps multiple selection locally; state the editing limit at the selection. */
export function selectionPropertiesNotice(count: number): string | null {
  return count > 1 ? 'Свойства нескольких объектов не редактируются вместе. Выберите один объект перед открытием свойств.' : null
}
